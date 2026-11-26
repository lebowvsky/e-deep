import { randomBytes } from 'node:crypto';
import type { Clock } from '../../../common/time/clock';
import { StaffTotp, TotpKeyMissingError } from './staff-totp';
import { encodeBase32, hotp, totpStepAt } from './totp';
import { TotpSecretCipher } from './totp-secret-cipher';

const KEY = randomBytes(32);
const ACCOUNT_ID = '01900000-0000-7000-8000-0000000000a1';
const EMAIL = 'ops@example.test';
const NOW = new Date('2026-11-27T10:00:10.000Z');
const STEP = totpStepAt(NOW);
const clock: Clock = { now: () => NOW };

function enrolled() {
  const cipher = new TotpSecretCipher(KEY);
  const staffTotp = new StaffTotp(cipher, clock);
  const { storedSecret, otpauthUri } = staffTotp.enrol(ACCOUNT_ID, EMAIL);
  const secret = cipher.decrypt(storedSecret, ACCOUNT_ID);
  const account = { id: ACCOUNT_ID, totpSecret: storedSecret, totpLastUsedStep: null };
  return { staffTotp, storedSecret, otpauthUri, secret, account };
}

describe('StaffTotp', () => {
  describe('enrol', () => {
    it('stores a new 20-byte secret encrypted for the account, shown once in the URI', () => {
      const { storedSecret, otpauthUri, secret } = enrolled();

      expect(secret).toHaveLength(20);
      expect(storedSecret).toMatch(/^v1\./);
      expect(storedSecret).not.toContain(encodeBase32(secret));
      expect(otpauthUri).toBe(
        `otpauth://totp/E-Deep:ops%40example.test?secret=${encodeBase32(secret)}&issuer=E-Deep&algorithm=SHA1&digits=6&period=30`,
      );
    });

    it('draws a new secret on every enrolment', () => {
      expect(enrolled().secret.equals(enrolled().secret)).toBe(false);
    });

    it('is refused without TOTP_ENCRYPTION_KEY, naming the variable only', () => {
      const staffTotp = StaffTotp.fromEncodedKey(undefined, clock);

      expect(staffTotp.isConfigured).toBe(false);
      expect(() => staffTotp.enrol(ACCOUNT_ID, EMAIL)).toThrow(TotpKeyMissingError);
      expect(() => staffTotp.assertConfigured()).toThrow(
        'TOTP_ENCRYPTION_KEY is required to enrol a staff account',
      );
    });
  });

  describe('decrypts (boot check of the key)', () => {
    it('is true with the key of the enrolment, false with another key or another account', () => {
      const { staffTotp, storedSecret } = enrolled();
      const otherKey = new StaffTotp(new TotpSecretCipher(randomBytes(32)), clock);

      expect(staffTotp.decrypts(ACCOUNT_ID, storedSecret)).toBe(true);
      expect(otherKey.decrypts(ACCOUNT_ID, storedSecret)).toBe(false);
      expect(staffTotp.decrypts('01900000-0000-7000-8000-0000000000b2', storedSecret)).toBe(false);
      expect(staffTotp.decrypts(ACCOUNT_ID, 'v1.garbage')).toBe(false);
    });

    it('is refused without TOTP_ENCRYPTION_KEY', () => {
      const { storedSecret } = enrolled();

      expect(() => new StaffTotp(null, clock).decrypts(ACCOUNT_ID, storedSecret)).toThrow(
        TotpKeyMissingError,
      );
    });
  });

  describe('fromEncodedKey', () => {
    it('builds the cipher from the base64 key', () => {
      const staffTotp = StaffTotp.fromEncodedKey(KEY.toString('base64'), clock);
      const { storedSecret } = staffTotp.enrol(ACCOUNT_ID, EMAIL);

      expect(new TotpSecretCipher(KEY).decrypt(storedSecret, ACCOUNT_ID)).toHaveLength(20);
    });

    it('refuses an invalid key without echoing it', () => {
      const invalid = 'not-a-key';

      expect(() => StaffTotp.fromEncodedKey(invalid, clock)).toThrow(
        'TOTP_ENCRYPTION_KEY is invalid',
      );
      expect(() => StaffTotp.fromEncodedKey(invalid, clock)).not.toThrow(/not-a-key/);
    });
  });

  describe('check', () => {
    it('accepts the current code and returns its step', () => {
      const { staffTotp, secret, account } = enrolled();

      expect(staffTotp.check(account, hotp(secret, STEP))).toEqual({ ok: true, step: STEP });
    });

    it('accepts the code of the previous step when the last accepted one is older', () => {
      const { staffTotp, secret, account } = enrolled();

      expect(
        staffTotp.check({ ...account, totpLastUsedStep: STEP - 2 }, hotp(secret, STEP - 1)),
      ).toEqual({ ok: true, step: STEP - 1 });
    });

    it.each([
      ['the step already accepted', 0],
      ['an older step, still inside the window', -1],
    ])('refuses as a replay a code of %s', (_case, offset) => {
      const { staffTotp, secret, account } = enrolled();

      expect(
        staffTotp.check({ ...account, totpLastUsedStep: STEP }, hotp(secret, STEP + offset)),
      ).toEqual({ ok: false, reason: 'totp-replayed' });
    });

    it('refuses a wrong code and a code two steps old', () => {
      const { staffTotp, secret, account } = enrolled();
      const wrong = hotp(secret, STEP) === '000000' ? '000001' : '000000';

      expect(staffTotp.check(account, wrong)).toEqual({ ok: false, reason: 'totp-wrong-code' });
      expect(staffTotp.check(account, hotp(secret, STEP - 2))).toEqual({
        ok: false,
        reason: 'totp-wrong-code',
      });
    });

    it('refuses a staff account not enrolled', () => {
      const { staffTotp } = enrolled();

      expect(
        staffTotp.check({ id: ACCOUNT_ID, totpSecret: null, totpLastUsedStep: null }, '123456'),
      ).toEqual({ ok: false, reason: 'totp-not-enrolled' });
    });

    it('refuses a secret bound to another account or encrypted with another key', () => {
      const { staffTotp, secret, account } = enrolled();
      const code = hotp(secret, STEP);
      const otherKey = new StaffTotp(new TotpSecretCipher(randomBytes(32)), clock);

      expect(staffTotp.check({ ...account, id: 'another-account' }, code)).toEqual({
        ok: false,
        reason: 'totp-undecryptable',
      });
      expect(otherKey.check(account, code)).toEqual({ ok: false, reason: 'totp-undecryptable' });
    });

    it('refuses every code without TOTP_ENCRYPTION_KEY', () => {
      const { secret, account } = enrolled();

      expect(new StaffTotp(null, clock).check(account, hotp(secret, STEP))).toEqual({
        ok: false,
        reason: 'totp-key-missing',
      });
    });
  });
});
