import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { isUniqueViolation } from '../../common/database/postgres-errors';
import {
  EmailTakenError,
  RegistrationClosedError,
  TooManyAttemptsError,
} from '../../common/errors/domain-errors';
import { Account } from '../accounts/account.entity';
import { normalizeEmail } from '../accounts/email';
import type { Diver } from '../divers/diver.entity';
import { DiversService } from '../divers/divers.service';
import { AUTH_SETTINGS, type AuthSettings } from './auth-settings';
import { AuthEventsService } from './auth-events.service';
import { toAuthenticatedAccount, type AuthenticatedAccount } from './authenticated-account';
import { LoginThrottle } from './login-throttle';
import { PasswordHasher } from './password/password-hasher';
import { PasswordPolicy } from './password/password-policy';
import { SessionService, type IssuedSession } from './session.service';

const EMAIL_UNIQUE_CONSTRAINT = 'uq_accounts__email';

/** Body of the minimal sign-up (`RegisterRequest`), plus the client IP for the rate limit. */
export interface RegistrationInput {
  readonly firstName: string;
  readonly email: string;
  readonly password: string;
  readonly ip: string;
  /**
   * Tokens of the web session cookies the browser already presents: revoked with the sign-up, like
   * a login (rotation). Absent or empty: nothing to revoke.
   */
  readonly replacedTokens?: readonly string[];
}

export interface RegistrationResult {
  readonly account: AuthenticatedAccount;
  /** Incomplete profile (no level): the front goes to `/welcome` (D38). */
  readonly diver: Diver;
  readonly session: IssuedSession;
}

/**
 * Minimal sign-up of the landing page (D36, D39): the diver (first name only), the account, a
 * session and the trail, in a single transaction; the web cookies already presented are revoked in
 * it (rotation, like a login). Signed in at once with a long web session
 * (« Rester connecté » is the default, D33).
 */
@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(AUTH_SETTINGS) private readonly settings: AuthSettings,
    private readonly diversService: DiversService,
    private readonly hasher: PasswordHasher,
    private readonly policy: PasswordPolicy,
    private readonly throttle: LoginThrottle,
    private readonly sessions: SessionService,
    private readonly authEvents: AuthEventsService,
  ) {}

  /**
   * @throws {RegistrationClosedError} when `REGISTRATION_ENABLED` is off.
   * @throws {DomainValidationError} for the email or the password (`fieldErrors.password`).
   * @throws {TooManyAttemptsError} | {EmailTakenError}
   */
  async register(input: RegistrationInput): Promise<RegistrationResult> {
    if (!this.settings.registrationEnabled) {
      throw new RegistrationClosedError();
    }
    const email = normalizeEmail(input.email);
    const decision = this.throttle.consume({ ip: input.ip, email });
    if (!decision.allowed) {
      this.logger.warn('registration_throttled');
      throw new TooManyAttemptsError(decision.retryAfterSeconds);
    }
    this.policy.assertAcceptable(
      input.password,
      { email, firstName: input.firstName, lastName: null },
      'password',
    );
    const passwordHash = await this.hasher.hash(input.password);

    try {
      return await this.dataSource.transaction(async (manager) => {
        const diver = await this.diversService.createIncompleteIn(manager, {
          firstName: input.firstName,
        });
        await manager.insert(Account, { diverId: diver.id, email, passwordHash, role: 'diver' });
        const account = await manager.findOneByOrFail(Account, { email });
        for (const token of input.replacedTokens ?? []) {
          await this.sessions.revokeIn(manager, token, 'web');
        }
        const session = await this.sessions.createIn(manager, account.id, 'web', {
          rememberMe: true,
        });
        await this.authEvents.recordIn(manager, account.id, 'account_created');
        return { account: toAuthenticatedAccount(account), diver, session };
      });
    } catch (error) {
      // Mapped by constraint name only: the driver message (which quotes the email) is dropped.
      if (isUniqueViolation(error, EMAIL_UNIQUE_CONSTRAINT)) {
        this.logger.log('registration_failed reason=email-taken');
        throw new EmailTakenError();
      }
      throw error;
    }
  }
}
