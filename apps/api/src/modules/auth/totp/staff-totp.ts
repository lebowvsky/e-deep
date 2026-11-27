import type { Clock } from '../../../common/time/clock';
import { generateTotpSecret, matchTotpStep, otpauthUri } from './totp';
import {
  TotpSecretCipher,
  TotpSecretDecryptionError,
  parseTotpEncryptionKey,
} from './totp-secret-cipher';

/** Issuer shown by the authenticator apps. */
export const TOTP_ISSUER = 'E-Deep';

/** An enrolment without `TOTP_ENCRYPTION_KEY`. Names the variable only. */
export class TotpKeyMissingError extends Error {
  override readonly name = 'TotpKeyMissingError';

  constructor() {
    super('TOTP_ENCRYPTION_KEY is required to enrol a staff account');
  }
}

/** The TOTP columns of a staff account. */
export interface TotpAccountState {
  readonly id: string;
  readonly totpSecret: string | null;
  readonly totpLastUsedStep: number | null;
}

/** Logged reason of a refused code; the answer is always the same `invalid-credentials`. */
export type TotpFailureReason =
  | 'totp-key-missing'
  | 'totp-not-enrolled'
  | 'totp-undecryptable'
  | 'totp-wrong-code'
  | 'totp-replayed';

export type TotpCheck =
  | { readonly ok: true; readonly step: number }
  | { readonly ok: false; readonly reason: TotpFailureReason };

export interface TotpEnrolment {
  /** Encrypted secret, for `accounts.totp_secret`. */
  readonly storedSecret: string;
  /** Printed once to the operator, never logged nor stored: it carries the secret in clear. */
  readonly otpauthUri: string;
}

/**
 * The staff second factor (D42): enrolment (new secret, encrypted for its account) and code check
 * against the stored secret. No database access: the caller stores the enrolment and accepts the
 * matched step atomically (anti-replay, RFC 6238 §5.2). Built without a cipher when
 * `TOTP_ENCRYPTION_KEY` is absent: every check then fails, and an enrolment is refused.
 */
export class StaffTotp {
  constructor(
    private readonly cipher: TotpSecretCipher | null,
    private readonly clock: Clock,
  ) {}

  /**
   * From the validated environment value (`undefined` when the variable is absent).
   *
   * @throws {Error} naming the variable only, for a value the environment schema should have refused.
   */
  static fromEncodedKey(encodedKey: string | undefined, clock: Clock): StaffTotp {
    if (encodedKey === undefined) {
      return new StaffTotp(null, clock);
    }
    const key = parseTotpEncryptionKey(encodedKey);
    if (key === null) {
      throw new Error('TOTP_ENCRYPTION_KEY is invalid');
    }
    return new StaffTotp(new TotpSecretCipher(key), clock);
  }

  get isConfigured(): boolean {
    return this.cipher !== null;
  }

  /** @throws {TotpKeyMissingError} without `TOTP_ENCRYPTION_KEY`. */
  assertConfigured(): void {
    this.requireCipher();
  }

  /** @throws {TotpKeyMissingError} without `TOTP_ENCRYPTION_KEY`. */
  enrol(accountId: string, email: string): TotpEnrolment {
    const cipher = this.requireCipher();
    const secret = generateTotpSecret();
    try {
      return {
        storedSecret: cipher.encrypt(secret, accountId),
        otpauthUri: otpauthUri({ issuer: TOTP_ISSUER, accountName: email, secret }),
      };
    } finally {
      secret.fill(0);
    }
  }

  /**
   * Whether the configured key decrypts `storedSecret` for its account: the boot check of a wrong
   * `TOTP_ENCRYPTION_KEY` (`TotpKeyBootCheck`). The decrypted secret is wiped at once.
   *
   * @throws {TotpKeyMissingError} without `TOTP_ENCRYPTION_KEY`.
   */
  decrypts(accountId: string, storedSecret: string): boolean {
    const cipher = this.requireCipher();
    try {
      cipher.decrypt(storedSecret, accountId).fill(0);
      return true;
    } catch (error) {
      if (error instanceof TotpSecretDecryptionError) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Whether `code` is the current code of the account and newer than the last accepted one. A
   * success still has to be accepted atomically (`totp_last_used_step`) by the caller.
   */
  check(account: TotpAccountState, code: string): TotpCheck {
    if (this.cipher === null) {
      return { ok: false, reason: 'totp-key-missing' };
    }
    if (account.totpSecret === null) {
      return { ok: false, reason: 'totp-not-enrolled' };
    }
    let secret: Buffer;
    try {
      secret = this.cipher.decrypt(account.totpSecret, account.id);
    } catch (error) {
      if (error instanceof TotpSecretDecryptionError) {
        return { ok: false, reason: 'totp-undecryptable' };
      }
      throw error;
    }
    try {
      const step = matchTotpStep(secret, code, this.clock.now());
      if (step === null) {
        return { ok: false, reason: 'totp-wrong-code' };
      }
      if (account.totpLastUsedStep !== null && step <= account.totpLastUsedStep) {
        return { ok: false, reason: 'totp-replayed' };
      }
      return { ok: true, step };
    } finally {
      secret.fill(0);
    }
  }

  private requireCipher(): TotpSecretCipher {
    if (this.cipher === null) {
      throw new TotpKeyMissingError();
    }
    return this.cipher;
  }
}
