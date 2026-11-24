import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  ForbiddenError,
  InvalidCredentialsError,
  TooManyAttemptsError,
  UnauthenticatedError,
} from '../../common/errors/domain-errors';
import { AuthEventsService } from '../auth/auth-events.service';
import { LoginThrottle } from '../auth/login-throttle';
import { PasswordHasher } from '../auth/password/password-hasher';
import { PasswordPolicy } from '../auth/password/password-policy';
import { SessionService, type IssuedSession } from '../auth/session.service';
import { DiversService } from '../divers/divers.service';
import { Account } from './account.entity';

/** Caller of an account route (from the future `AuthContext`), plus the client IP. */
export interface AccountCaller {
  readonly accountId: string;
  readonly sessionId: string;
  readonly ip: string;
}

export interface ChangePasswordInput {
  readonly currentPassword: string;
  readonly newPassword: string;
}

/**
 * Account management of a diver (`/me`, D33, D38). Both actions re-check the password, rate
 * limited like a login (the same buckets: a stolen session cannot brute-force the password).
 */
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly hasher: PasswordHasher,
    private readonly policy: PasswordPolicy,
    private readonly throttle: LoginThrottle,
    private readonly sessions: SessionService,
    private readonly authEvents: AuthEventsService,
    private readonly diversService: DiversService,
  ) {}

  /**
   * Checks the current password, applies the policy to the new one, then in one transaction
   * stores its hash, revokes every other session and rotates the caller's (new token, same
   * expiry): the returned session replaces the cookie (lot 3).
   *
   * @throws {TooManyAttemptsError} | {InvalidCredentialsError} for the current password.
   * @throws {DomainValidationError} `fieldErrors.newPassword` for the new one.
   * @throws {UnauthenticatedError} when the account or the session is gone meanwhile.
   */
  async changePassword(caller: AccountCaller, input: ChangePasswordInput): Promise<IssuedSession> {
    const account = await this.verifiedAccount(caller, input.currentPassword);
    const firstName = account.diver?.firstName ?? '';
    this.policy.assertAcceptable(
      input.newPassword,
      { email: account.email, firstName, lastName: account.diver?.lastName ?? null },
      'newPassword',
    );
    const passwordHash = await this.hasher.hash(input.newPassword);

    const session = await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Account,
        { id: account.id },
        { passwordHash, passwordChangedAt: () => 'now()' },
      );
      await this.sessions.revokeAllIn(manager, account.id, caller.sessionId);
      const rotated = await this.sessions.rotateIn(manager, account.id, caller.sessionId);
      await this.authEvents.recordIn(manager, account.id, 'password_changed');
      return rotated;
    });
    this.logger.log('password_changed');
    return session;
  }

  /**
   * GDPR erasure on request (art. 17, D38), after the password is typed again: the diver and
   * everything it owns, the account, its sessions and its trail (cascade). The `account_deleted`
   * event is written without an account, which is gone.
   *
   * @throws {TooManyAttemptsError} | {InvalidCredentialsError}
   * @throws {ForbiddenError} for a staff account (no diver to erase).
   */
  async deleteAccount(caller: AccountCaller, password: string): Promise<void> {
    const account = await this.verifiedAccount(caller, password);
    const { diverId } = account;
    if (diverId === null) {
      throw new ForbiddenError();
    }
    await this.dataSource.transaction(async (manager) => {
      await this.diversService.deleteAccountIn(manager, diverId);
      await this.authEvents.recordIn(manager, null, 'account_deleted');
    });
    this.logger.log('account_deleted');
  }

  /** The caller's account, once its password is checked (rate limited, D35). */
  private async verifiedAccount(caller: AccountCaller, password: string): Promise<Account> {
    const account = await this.dataSource.manager.findOne(Account, {
      where: { id: caller.accountId },
      relations: { diver: true },
    });
    if (account === null) {
      throw new UnauthenticatedError();
    }
    const decision = this.throttle.consume({ ip: caller.ip, email: account.email });
    if (!decision.allowed) {
      this.logger.warn('password_check_throttled');
      throw new TooManyAttemptsError(decision.retryAfterSeconds);
    }
    const check = await this.hasher.check(password, account.passwordHash);
    if (check !== 'match') {
      this.logger.log(
        `password_check_failed reason=${check === 'mismatch' ? 'wrong-password' : check}`,
      );
      // A wrong password typed on an account route is a failed authentication of that account.
      await this.authEvents.record(account.id, 'login_failed');
      throw new InvalidCredentialsError();
    }
    return account;
  }
}
