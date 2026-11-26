import { randomBytes } from 'node:crypto';
import {
  TotpSecretCipher,
  TotpSecretDecryptionError,
  parseTotpEncryptionKey,
} from './totp-secret-cipher';

const KEY = randomBytes(32);
const ACCOUNT_ID = '01900000-0000-7000-8000-0000000000a1';
const OTHER_ACCOUNT_ID = '01900000-0000-7000-8000-0000000000a2';
const SECRET = Buffer.from('12345678901234567890', 'ascii');

/** `stored` with one byte of its part `index` (1 = IV, 2 = tag, 3 = ciphertext) flipped. */
function tampered(stored: string, index: number): string {
  const parts = stored.split('.');
  const bytes = Buffer.from(parts[index] ?? '', 'base64url');
  bytes[0] = (bytes[0] ?? 0) ^ 0x01;
  parts[index] = bytes.toString('base64url');
  return parts.join('.');
}

describe('TotpSecretCipher', () => {
  const cipher = new TotpSecretCipher(KEY);

  it('round-trips a secret for its account', () => {
    const stored = cipher.encrypt(SECRET, ACCOUNT_ID);

    expect(cipher.decrypt(stored, ACCOUNT_ID).equals(SECRET)).toBe(true);
  });

  it('stores v1.<iv 12 B>.<tag 16 B>.<ciphertext> in base64url, never the secret in clear', () => {
    const stored = cipher.encrypt(SECRET, ACCOUNT_ID);
    const [version, iv, tag, ciphertext] = stored.split('.');

    expect(version).toBe('v1');
    expect(stored).toMatch(/^v1(\.[A-Za-z0-9_-]+){3}$/);
    expect(Buffer.from(iv ?? '', 'base64url')).toHaveLength(12);
    expect(Buffer.from(tag ?? '', 'base64url')).toHaveLength(16);
    expect(Buffer.from(ciphertext ?? '', 'base64url')).toHaveLength(SECRET.length);
    expect(stored).not.toContain(SECRET.toString('base64url'));
    expect(stored).not.toContain(SECRET.toString('ascii'));
  });

  it('draws a new IV each time: the same secret never gives the same value', () => {
    expect(cipher.encrypt(SECRET, ACCOUNT_ID)).not.toBe(cipher.encrypt(SECRET, ACCOUNT_ID));
  });

  it.each([
    ['the IV', 1],
    ['the tag', 2],
    ['the ciphertext', 3],
  ])('refuses a value whose %s was tampered with', (_part, index) => {
    const stored = tampered(cipher.encrypt(SECRET, ACCOUNT_ID), index);

    expect(() => cipher.decrypt(stored, ACCOUNT_ID)).toThrow(TotpSecretDecryptionError);
  });

  it('refuses the secret of another account (AAD): a copied value does not decrypt', () => {
    const stored = cipher.encrypt(SECRET, ACCOUNT_ID);

    expect(() => cipher.decrypt(stored, OTHER_ACCOUNT_ID)).toThrow(TotpSecretDecryptionError);
  });

  it('refuses a value encrypted with another key', () => {
    const stored = new TotpSecretCipher(randomBytes(32)).encrypt(SECRET, ACCOUNT_ID);

    expect(() => cipher.decrypt(stored, ACCOUNT_ID)).toThrow(TotpSecretDecryptionError);
  });

  it.each([
    ['empty', ''],
    ['an unknown version', 'v2.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA.AAAA'],
    ['missing parts', 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA'],
    ['extra parts', 'v1.AAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAA.AAAA.AAAA'],
    ['a short IV', 'v1.AAAA.AAAAAAAAAAAAAAAAAAAAAA.AAAA'],
    ['a short tag', 'v1.AAAAAAAAAAAAAAAA.AAAA.AAAA'],
  ])('refuses a value %s, with a static message', (_case, stored) => {
    expect(() => cipher.decrypt(stored, ACCOUNT_ID)).toThrow(
      new TotpSecretDecryptionError().message,
    );
  });

  it('never puts the key, the secret nor the value in its error message', () => {
    const stored = tampered(cipher.encrypt(SECRET, ACCOUNT_ID), 3);

    let message = '';
    try {
      cipher.decrypt(stored, ACCOUNT_ID);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toBe('TOTP secret cannot be decrypted');
  });

  it.each([0, 16, 31, 33])('refuses a key of %i bytes', (length) => {
    expect(() => new TotpSecretCipher(randomBytes(length))).toThrow(
      'TOTP encryption key must be 32 bytes',
    );
  });
});

describe('parseTotpEncryptionKey', () => {
  it('accepts the canonical base64 of 32 bytes', () => {
    expect(parseTotpEncryptionKey(KEY.toString('base64'))?.equals(KEY)).toBe(true);
  });

  it.each([
    ['31 bytes', randomBytes(31).toString('base64')],
    ['33 bytes', randomBytes(33).toString('base64')],
    ['empty', ''],
    ['without padding', KEY.toString('base64').replace(/=+$/, '')],
    ['base64url', Buffer.alloc(32, 0xfb).toString('base64url')],
    ['with a trailing space', `${KEY.toString('base64')} `],
    ['hex', KEY.toString('hex')],
  ])('refuses %s', (_case, encoded) => {
    expect(parseTotpEncryptionKey(encoded)).toBeNull();
  });
});
