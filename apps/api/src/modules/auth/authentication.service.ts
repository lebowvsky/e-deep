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
import { StaffTotp, type TotpFailureReason } from './totp/staff-totp';

/** What every login carries besides its body. */
interface LoginContext {
  /** Rate-limit key of the client IP (`clientIpKey(req.ip)`). Never logged. */
  readonly ip: string;
  /**
   * Tokens of the session cookies of the audience the browser already presents: they are revoked
   * with the login (rotation, no session fixation). Absent or empty: nothing to revoke.
   */
  readonly replacedTokens?: readonly string[];
}

/** Body of a web login (`LoginRequest`). */
export interface DiverLoginInput extends LoginContext {
  readonly email: string;
  readonly password: string;
  readonly rememberMe: boolean;
}

/** Body of an admin login (`AdminLoginRequest`). */
export interface StaffLoginInput extends LoginContext {
  readonly email: string;
  readonly password: string;
  /** The current TOTP code of the account (D42); never logged. */
  readonly totpCode: string;
}

export interface LoginResult {
  readonly account: AuthenticatedAccount;
  /** A new session on every login (rotation: a token is never reused across logins). */
  readonly session: IssuedSession;
}

/** Logged reason of a failed login; the answer is always the same `invalid-credentials`. */
type LoginFailureReason =
  'unknown-account' | 'wrong-password' | 'wrong-audience' | 'malformed-hash' | TotpFailureReason;

interface AudienceRule {
  readonly audience: SessionAudience;
  readonly accepts: (role: AccountRole) => boolean;
  readonly rememberMe: boolean;
  /** The TOTP code of a staff login, checked after the password; `null` on the web. */
  readonly totpCode: string | null;
}

/**
 * Sign-in and sign-out of the two audiences (D33, D35, D42). A login rotates the session: the
 * cookies already presented are revoked with it. Every failure is the same `invalid-credentials`:
 * unknown email, wrong password, an account of the other audience (a staff account on the web,
 * a diver on the admin), or, on the admin, a wrong, replayed or unverifiable TOTP code. The work is
 * the same too: an unknown email still costs a full Argon2id verification, against the boot-time
 * dummy hash. The TOTP code is only checked once the password is right.
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
    private readonly staffTotp: StaffTotp,
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
      totpCode: null,
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
      totpCode: input.totpCode,
    });
  }

  /**
   * Logout (§3): deletes the sessions of the presented tokens of `audience`, and records one
   * `logout` per session actually deleted (one query per token; a concurrent logout of the same
   * token records nothing more). Idempotent: no token, or an unknown one, is a no-op. A session
   * expired but not purged yet is deleted and traced too.
   */
  async signOut(tokens: readonly string[], audience: SessionAudience): Promise<void> {
    for (const token of tokens) {
      const accountId = await this.sessions.revoke(token, audience);
      if (accountId !== null) {
        await this.authEvents.record(accountId, 'logout');
        this.logger.log('logout');
      }
    }
  }

  /** `logout-all`: ends every session of the account, the caller's included (`sessions_revoked`). */
  async signOutEverywhere(accountId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.sessions.revokeAllIn(manager, accountId);
      await this.authEvents.recordIn(manager, accountId, 'sessions_revoked');
    });
    this.logger.log('sessions_revoked');
  }

  private async login(
    input: {
      readonly email: string;
      readonly password: string;
    } & LoginContext,
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

    if (rule.totpCode !== null) {
      const totpFailure = await this.acceptTotp(account, rule.totpCode);
      if (totpFailure !== null) {
        return this.fail(account.id, totpFailure);
      }
    }

    // Hashed before the transaction: no connection is held during the Argon2id work.
    const rehashed = this.hasher.needsRehash(account.passwordHash)
      ? await this.hasher.hash(input.password)
      : null;
    const session = await this.dataSource.transaction(async (manager) => {
      if (rehashed !== null) {
        await manager.update(Account, { id: account.id }, { passwordHash: rehashed });
      }
      for (const token of input.replacedTokens ?? []) {
        await this.sessions.revokeIn(manager, token, rule.audience);
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

  /**
   * Checks the TOTP code, then accepts its step with a conditional `UPDATE` (RFC 6238 §5.2): of
   * two concurrent logins with the same code, only one updates the row, the other is a replay. The
   * `UPDATE` is also bound to the stored secret the code was checked against (its ciphertext is
   * unique per enrolment: random IV): an `account:reset-totp` committed since the account was read
   * (new secret, step cleared, sessions revoked) makes it match no row, so no session outlives the
   * reset. The step is consumed even if the session creation fails afterwards: the holder waits
   * for the next code (fail closed).
   *
   * @returns `null` once accepted, otherwise the logged reason of the refusal.
   */
  private async acceptTotp(account: Account, code: string): Promise<TotpFailureReason | null> {
    const check = this.staffTotp.check(account, code);
    if (!check.ok) {
      return check.reason;
    }
    const result = await this.dataSource.manager
      .createQueryBuilder()
      .update(Account)
      .set({ totpLastUsedStep: check.step })
      .where('id = :id', { id: account.id })
      .andWhere('(totp_last_used_step IS NULL OR totp_last_used_step < :step)', {
        step: check.step,
      })
      // A successful check implies a non-null secret; `= NULL` would match nothing anyway.
      .andWhere('totp_secret = :secret', { secret: account.totpSecret })
      .execute();
    return result.affected === 1 ? null : 'totp-replayed';
  }

  private async fail(accountId: string | null, reason: LoginFailureReason): Promise<never> {
    this.logger.log(`login_failed reason=${reason}`);
    await this.authEvents.record(accountId, 'login_failed');
    throw new InvalidCredentialsError();
  }
}
