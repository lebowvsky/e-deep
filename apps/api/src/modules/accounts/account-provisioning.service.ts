import type { StaffRole } from '@e-deep/shared';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { isUniqueViolation } from '../../common/database/postgres-errors';
import {
  DomainValidationError,
  EmailTakenError,
  InvalidReferenceError,
} from '../../common/errors/domain-errors';
import { AuthEventsService } from '../auth/auth-events.service';
import { emailSyntaxError, isWithinPasswordInputBound } from '../auth/dto/credential-rules';
import { PasswordHasher } from '../auth/password/password-hasher';
import { PasswordPolicy, type PasswordIdentity } from '../auth/password/password-policy';
import { SessionService } from '../auth/session.service';
import { Account } from './account.entity';
import { normalizeEmail } from './email';

const EMAIL_UNIQUE_CONSTRAINT = 'uq_accounts__email';

export interface StaffAccountInput {
  readonly role: StaffRole;
  readonly email: string;
  readonly password: string;
}

export interface PasswordResetInput {
  readonly email: string;
  readonly password: string;
}

/**
 * Accounts managed by an operator, behind the commands `account:create-staff` and
 * `account:reset-password` (D39, D42; `src/cli`). The same rules as the HTTP routes apply: email
 * syntax of the sign-in DTO (`emailSyntaxError`) then its normalisation, the raw bound of a typed password (128 code points) and the password policy.
 * Errors are codes only, never a value; logs are event names only.
 */
@Injectable()
export class AccountProvisioningService {
  private readonly logger = new Logger(AccountProvisioningService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly hasher: PasswordHasher,
    private readonly policy: PasswordPolicy,
    private readonly sessions: SessionService,
    private readonly authEvents: AuthEventsService,
  ) {}

  /**
   * A staff account (`support` or `admin`), without a diver (D36). The TOTP enrolment comes with
   * lot 7 (D42).
   *
   * @throws {DomainValidationError} `fieldErrors.email` or `fieldErrors.password`.
   * @throws {EmailTakenError}
   */
  async createStaffAccount(input: StaffAccountInput): Promise<void> {
    const email = acceptedEmail(input.email);
    const passwordHash = await this.acceptedHash(input.password, {
      email,
      firstName: '',
      lastName: null,
    });
    try {
      await this.dataSource.transaction(async (manager) => {
        const result = await manager.insert(Account, {
          diverId: null,
          email,
          passwordHash,
          role: input.role,
        });
        const accountId: unknown = result.identifiers[0]?.['id'];
        if (typeof accountId !== 'string') {
          throw new Error('Account insert returned no id');
        }
        await this.authEvents.recordIn(manager, accountId, 'account_created');
      });
    } catch (error) {
      // Mapped by constraint name only: the driver message quotes the email.
      if (isUniqueViolation(error, EMAIL_UNIQUE_CONSTRAINT)) {
        throw new EmailTakenError();
      }
      throw error;
    }
    this.logger.log('staff_account_created');
  }

  /**
   * Sets a new password chosen by the account holder and typed by the operator (no email in V1,
   * D39), then ends every session of the account.
   *
   * @throws {DomainValidationError} `fieldErrors.email` or `fieldErrors.password`.
   * @throws {InvalidReferenceError} when no account has this email.
   */
  async resetPassword(input: PasswordResetInput): Promise<void> {
    const email = acceptedEmail(input.email);
    const account = await this.dataSource.manager.findOne(Account, {
      where: { email },
      relations: { diver: true },
    });
    if (account === null) {
      throw new InvalidReferenceError();
    }
    const passwordHash = await this.acceptedHash(input.password, {
      email,
      firstName: account.diver?.firstName ?? '',
      lastName: account.diver?.lastName ?? null,
    });
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Account,
        { id: account.id },
        { passwordHash, passwordChangedAt: () => 'now()' },
      );
      await this.sessions.revokeAllIn(manager, account.id);
      await this.authEvents.recordIn(manager, account.id, 'password_reset_by_operator');
    });
    this.logger.log('password_reset_by_operator');
  }

  /** The hash of a password that passes the raw bound and the policy (D35). */
  private async acceptedHash(password: string, identity: PasswordIdentity): Promise<string> {
    if (!isWithinPasswordInputBound(password)) {
      throw new DomainValidationError({ password: ['too-long'] });
    }
    this.policy.assertAcceptable(password, identity, 'password');
    return this.hasher.hash(password);
  }
}

/**
 * An email the sign-in DTO accepts (`IsEmailAddress`), normalised (`normalizeEmail`).
 *
 * @throws {DomainValidationError} `fieldErrors.email`: `length`, `format`, `invalid-character`.
 */
function acceptedEmail(raw: string): string {
  const syntaxError = emailSyntaxError(raw);
  if (syntaxError !== null) {
    throw new DomainValidationError({ email: [syntaxError] });
  }
  return normalizeEmail(raw);
}
