import type { AccountRole } from '@e-deep/shared';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InvalidCredentialsError, TooManyAttemptsError } from '../../common/errors/domain-errors';
import { Account } from '../accounts/account.entity';
import { normalizeEmail } from '../accounts/email';
import { AuthEventsService } from './auth-events.service';
import { toAuthenticatedAccount, type AuthenticatedAccount } from './authenticated-account';
import { LoginThrottle } from './login-throttle';
import { PasswordHasher } from './password/password-hasher';
import type { SessionAudience } from './session-audiences';
import { SessionService, type IssuedSession } from './session.service';

/** Body of a web login, plus the client IP for the rate limit (lot 3 reads `req.ip`). */
export interface DiverLoginInput {
  readonly email: string;
  readonly password: string;
  readonly rememberMe: boolean;
  readonly ip: string;
}

/** Body of an admin login. The TOTP code joins it with lot 7 (D42). */
export interface StaffLoginInput {
  readonly email: string;
  readonly password: string;
  readonly ip: string;
}

export interface LoginResult {
  readonly account: AuthenticatedAccount;
  /** A new session on every login (rotation: a token is never reused across logins). */
  readonly session: IssuedSession;
}

/** Logged reason of a failed login; the answer is always the same `invalid-credentials`. */
type LoginFailureReason =
  'unknown-account' | 'wrong-password' | 'wrong-audience' | 'malformed-hash';

interface AudienceRule {
  readonly audience: SessionAudience;
  readonly accepts: (role: AccountRole) => boolean;
  readonly rememberMe: boolean;
}

/**
 * Sign-in of the two audiences (D33, D35, D42). Every failure is the same `invalid-credentials`:
 * unknown email, wrong password, or an account of the other audience (a staff account on the web,
 * a diver on the admin). The work is the same too: an unknown email still costs a full Argon2id
 * verification, against the boot-time dummy hash.
 *
 * Logs carry the event name and a reason code only (D40).
 */
@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly hasher: PasswordHasher,
    private readonly throttle: LoginThrottle,
    private readonly sessions: SessionService,
    private readonly authEvents: AuthEventsService,
  ) {}

  /**
   * @throws {DomainValidationError} for an email the accounts cannot hold (non-ASCII…).
   * @throws {TooManyAttemptsError} | {InvalidCredentialsError}
   */
  loginDiver(input: DiverLoginInput): Promise<LoginResult> {
    return this.login(input, {
      audience: 'web',
      accepts: (role) => role === 'diver',
      rememberMe: input.rememberMe,
    });
  }

  /**
   * @throws {DomainValidationError} for an email the accounts cannot hold (non-ASCII…).
   * @throws {TooManyAttemptsError} | {InvalidCredentialsError}
   */
  loginStaff(input: StaffLoginInput): Promise<LoginResult> {
    return this.login(input, {
      audience: 'admin',
      accepts: (role) => role !== 'diver',
      // Staff sessions are always short (D42).
      rememberMe: false,
    });
  }

  private async login(
    input: { readonly email: string; readonly password: string; readonly ip: string },
    rule: AudienceRule,
  ): Promise<LoginResult> {
    const email = normalizeEmail(input.email);

    const decision = this.throttle.consume({ ip: input.ip, email });
    if (!decision.allowed) {
      // Traced once per throttling window and key, not on every 429 (no table flooding).
      if (decision.justThrottled) {
        this.logger.warn('login_throttled');
        await this.authEvents.record(null, 'login_throttled');
      }
      throw new TooManyAttemptsError(decision.retryAfterSeconds);
    }

    const account = await this.dataSource.manager.findOneBy(Account, { email });
    if (account === null) {
      await this.hasher.verifyDummy(input.password);
      return this.fail(null, 'unknown-account');
    }
    // Verified even for the wrong audience, so that the timing does not tell the roles apart.
    const check = await this.hasher.check(input.password, account.passwordHash);
    if (!rule.accepts(account.role)) {
      return this.fail(account.id, 'wrong-audience');
    }
    if (check === 'malformed-hash') {
      return this.fail(account.id, 'malformed-hash');
    }
    if (check === 'mismatch') {
      return this.fail(account.id, 'wrong-password');
    }

    // Lot 7 (D42): the staff TOTP code is checked here, before any session is created; a wrong or
    // replayed code ends in `this.fail(account.id, …)` with a new `LoginFailureReason`.

    // Hashed before the transaction: no connection is held during the Argon2id work.
    const rehashed = this.hasher.needsRehash(account.passwordHash)
      ? await this.hasher.hash(input.password)
      : null;
    const session = await this.dataSource.transaction(async (manager) => {
      if (rehashed !== null) {
        await manager.update(Account, { id: account.id }, { passwordHash: rehashed });
      }
      const issued = await this.sessions.createIn(manager, account.id, rule.audience, {
        rememberMe: rule.rememberMe,
      });
      await this.authEvents.recordIn(manager, account.id, 'login_succeeded');
      return issued;
    });
    this.logger.log('login_succeeded');
    return { account: toAuthenticatedAccount(account), session };
  }

  private async fail(accountId: string | null, reason: LoginFailureReason): Promise<never> {
    this.logger.log(`login_failed reason=${reason}`);
    await this.authEvents.record(accountId, 'login_failed');
    throw new InvalidCredentialsError();
  }
}
