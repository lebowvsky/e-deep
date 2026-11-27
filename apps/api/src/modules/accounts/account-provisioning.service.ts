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
import { StaffTotp } from '../auth/totp/staff-totp';
import { isStaffRole } from './account-lists';
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

/** A new TOTP secret of a staff account, to show to the operator once. */
export interface StaffTotpEnrolment {
  /** `otpauth://totp/…`: carries the secret in clear. Printed once, never logged nor stored. */
  readonly otpauthUri: string;
}

/**
 * Accounts managed by an operator, behind the commands `account:create-staff`,
 * `account:reset-password` and `account:reset-totp` (D39, D42; `src/cli`). The same rules as the HTTP routes apply: email
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
    private readonly staffTotp: StaffTotp,
  ) {}

  /**
   * A staff account (`support` or `admin`), without a diver (D36), enrolled in TOTP (D42): its
   * secret is generated and stored encrypted in the same transaction.
   *
   * @throws {TotpKeyMissingError} without `TOTP_ENCRYPTION_KEY`, before anything is written.
   * @throws {DomainValidationError} `fieldErrors.email` or `fieldErrors.password`.
   * @throws {EmailTakenError}
   */
  async createStaffAccount(input: StaffAccountInput): Promise<StaffTotpEnrolment> {
    this.staffTotp.assertConfigured();
    const email = acceptedEmail(input.email);
    const passwordHash = await this.acceptedHash(input.password, {
      email,
      firstName: '',
      lastName: null,
    });
    let enrolment: StaffTotpEnrolment;
    try {
      enrolment = await this.dataSource.transaction(async (manager) => {
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
        // The secret is bound to the account id (AAD): it can only be encrypted once the id exists.
        const { storedSecret, otpauthUri } = this.staffTotp.enrol(accountId, email);
        await manager.update(Account, { id: accountId }, { totpSecret: storedSecret });
        await this.authEvents.recordIn(manager, accountId, 'account_created');
        return { otpauthUri };
      });
    } catch (error) {
      // Mapped by constraint name only: the driver message quotes the email.
      if (isUniqueViolation(error, EMAIL_UNIQUE_CONSTRAINT)) {
        throw new EmailTakenError();
      }
      throw error;
    }
    this.logger.log('staff_account_created');
    return enrolment;
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

  /**
   * Replaces the TOTP secret of a staff account (lost or compromised authenticator), then ends
   * every session of the account. A diver account and an unknown email get the same error.
   *
   * The account is read in the transaction under `FOR UPDATE`: two concurrent resets of the same
   * account serialise (the last one wins, both traced), and an account deleted meanwhile is the
   * same `invalid-reference`, never a foreign-key error.
   *
   * @throws {TotpKeyMissingError} without `TOTP_ENCRYPTION_KEY`, before anything is read.
   * @throws {DomainValidationError} `fieldErrors.email`.
   * @throws {InvalidReferenceError} when no staff account has this email.
   */
  async resetTotp(input: { readonly email: string }): Promise<StaffTotpEnrolment> {
    this.staffTotp.assertConfigured();
    const email = acceptedEmail(input.email);
    const enrolment = await this.dataSource.transaction(async (manager) => {
      const account = await manager.findOne(Account, {
        where: { email },
        lock: { mode: 'pessimistic_write' },
      });
      if (account === null || !isStaffRole(account.role)) {
        throw new InvalidReferenceError();
      }
      const { storedSecret, otpauthUri } = this.staffTotp.enrol(account.id, email);
      // A new secret starts a new history of steps: no code of the old one can match it.
      await manager.update(
        Account,
        { id: account.id },
        { totpSecret: storedSecret, totpLastUsedStep: null },
      );
      await this.sessions.revokeAllIn(manager, account.id);
      await this.authEvents.recordIn(manager, account.id, 'totp_reset');
      return { otpauthUri };
    });
    this.logger.log('totp_reset');
    return enrolment;
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
