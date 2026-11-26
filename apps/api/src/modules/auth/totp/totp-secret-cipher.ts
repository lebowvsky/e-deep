import {
  createCipheriv,
  createDecipheriv,
  createSecretKey,
  randomBytes,
  type KeyObject,
} from 'node:crypto';

/** Size of `TOTP_ENCRYPTION_KEY` once decoded: AES-256. */
export const TOTP_KEY_BYTES = 32;

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** A stored secret that cannot be read back. Static message: never the value nor the key. */
export class TotpSecretDecryptionError extends Error {
  override readonly name = 'TotpSecretDecryptionError';

  constructor() {
    super('TOTP secret cannot be decrypted');
  }
}

/**
 * The 32 bytes of a canonical base64 `TOTP_ENCRYPTION_KEY`, or `null` for anything else (wrong
 * length, base64url, missing padding, stray characters).
 */
export function parseTotpEncryptionKey(encoded: string): Buffer | null {
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== TOTP_KEY_BYTES || key.toString('base64') !== encoded) {
    return null;
  }
  return key;
}

/**
 * Encryption at rest of the staff TOTP secrets (D42): AES-256-GCM, a random 12-byte IV per
 * encryption, a 16-byte tag, and the account id as additional authenticated data, so that a
 * secret copied onto another account no longer decrypts. Stored as
 * `v1.<iv>.<tag>.<ciphertext>` (base64url); the version leaves room for a key rotation.
 *
 * Never logs: neither the key, the secret nor the stored value.
 */
export class TotpSecretCipher {
  private readonly key: KeyObject;

  /** @throws {RangeError} when the key is not 32 bytes (message without the key). */
  constructor(key: Uint8Array) {
    if (key.length !== TOTP_KEY_BYTES) {
      throw new RangeError('TOTP encryption key must be 32 bytes');
    }
    this.key = createSecretKey(key);
  }

  encrypt(secret: Uint8Array, accountId: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(Buffer.from(accountId, 'utf8'));
    const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
    const encoded = [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url'));
    return [VERSION, ...encoded].join('.');
  }

  /**
   * @throws {TotpSecretDecryptionError} for an unknown format or version, a tampered value, a
   *   value bound to another account, or another key.
   */
  decrypt(stored: string, accountId: string): Buffer {
    const [version, ...encoded] = stored.split('.');
    if (version !== VERSION || encoded.length !== 3) {
      throw new TotpSecretDecryptionError();
    }
    const [iv, tag, ciphertext] = encoded.map((part) => Buffer.from(part, 'base64url'));
    if (iv?.length !== IV_BYTES || tag?.length !== TAG_BYTES || ciphertext === undefined) {
      throw new TotpSecretDecryptionError();
    }
    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_BYTES });
      decipher.setAAD(Buffer.from(accountId, 'utf8'));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      // The OpenSSL message is not kept: a failed authentication has nothing more to tell.
      throw new TotpSecretDecryptionError();
    }
  }
}
