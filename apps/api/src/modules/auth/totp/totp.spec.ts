import {
  TOTP_SECRET_BYTES,
  encodeBase32,
  generateTotpSecret,
  hotp,
  matchTotpStep,
  otpauthUri,
  totpStepAt,
} from './totp';

/** The SHA-1 seed of RFC 6238 Appendix B (also the RFC 4226 Appendix D one). */
const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');

const at = (unixSeconds: number): Date => new Date(unixSeconds * 1000);

describe('hotp', () => {
  // RFC 4226 Appendix D: counters 0 to 9, 6 digits.
  it.each([
    [0, '755224'],
    [1, '287082'],
    [2, '359152'],
    [3, '969429'],
    [4, '338314'],
    [5, '254676'],
    [6, '287922'],
    [7, '162583'],
    [8, '399871'],
    [9, '520489'],
  ])('RFC 4226 counter %i → %s', (counter, code) => {
    expect(hotp(RFC_SECRET, counter)).toBe(code);
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])('refuses the counter %p', (counter) => {
    expect(() => hotp(RFC_SECRET, counter)).toThrow(RangeError);
  });
});

describe('RFC 6238 Appendix B, SHA-1, 8 digits', () => {
  it.each([
    [59, 1, '94287082'],
    [1_111_111_109, 0x23523ec, '07081804'],
    [1_111_111_111, 0x23523ed, '14050471'],
    [1_234_567_890, 0x273ef07, '89005924'],
    [2_000_000_000, 0x3f940aa, '69279037'],
    [20_000_000_000, 0x27bc86aa, '65353130'],
  ])('T = %i s: step %i, code %s', (unixSeconds, step, code) => {
    expect(totpStepAt(at(unixSeconds))).toBe(step);
    expect(hotp(RFC_SECRET, step, 8)).toBe(code);
    expect(matchTotpStep(RFC_SECRET, code, at(unixSeconds), 8)).toBe(step);
  });
});

describe('matchTotpStep (6 digits, ±1 step)', () => {
  const now = at(1_234_567_890);
  const step = totpStepAt(now);
  const codeOf = (offset: number): string => hotp(RFC_SECRET, step + offset);

  it.each([
    ['the current step', 0],
    ['the previous step (authenticator late)', -1],
    ['the next step (authenticator early)', 1],
  ])('accepts a code of %s and returns that step', (_case, offset) => {
    expect(matchTotpStep(RFC_SECRET, codeOf(offset), now)).toBe(step + offset);
  });

  it.each([
    ['two steps ago', -2],
    ['two steps ahead', 2],
  ])('refuses a code of %s (outside the window)', (_case, offset) => {
    expect(matchTotpStep(RFC_SECRET, codeOf(offset), now)).toBeNull();
  });

  it('accepts the code of a step until the end of the next one, not after', () => {
    const code = codeOf(0);
    const stepStartSeconds = step * 30;

    expect(matchTotpStep(RFC_SECRET, code, at(stepStartSeconds + 59))).toBe(step);
    expect(matchTotpStep(RFC_SECRET, code, at(stepStartSeconds + 60))).toBeNull();
    expect(matchTotpStep(RFC_SECRET, code, at(stepStartSeconds - 30))).toBe(step);
    expect(matchTotpStep(RFC_SECRET, code, at(stepStartSeconds - 31))).toBeNull();
  });

  it('returns the same step for the same code twice: the caller enforces the anti-replay', () => {
    const code = codeOf(0);

    expect(matchTotpStep(RFC_SECRET, code, now)).toBe(step);
    expect(matchTotpStep(RFC_SECRET, code, now)).toBe(step);
  });

  it('refuses the code of another secret', () => {
    expect(matchTotpStep(Buffer.alloc(20, 7), codeOf(0), now)).toBeNull();
  });

  it.each(['', '12345', '1234567', '12345a', ' 123456', '１２３４５６', '12 456'])(
    'refuses the malformed code %p without throwing',
    (code) => {
      expect(matchTotpStep(RFC_SECRET, code, now)).toBeNull();
    },
  );
});

describe('encodeBase32 (RFC 4648 §10 vectors, no padding)', () => {
  it.each([
    ['', ''],
    ['f', 'MY'],
    ['fo', 'MZXQ'],
    ['foo', 'MZXW6'],
    ['foob', 'MZXW6YQ'],
    ['fooba', 'MZXW6YTB'],
    ['foobar', 'MZXW6YTBOI'],
  ])('%p → %p', (input, encoded) => {
    expect(encodeBase32(Buffer.from(input, 'ascii'))).toBe(encoded);
  });

  it('encodes the RFC 6238 seed as authenticator apps expect it', () => {
    expect(encodeBase32(RFC_SECRET)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('encodes every bit (all ones, all zeros)', () => {
    expect(encodeBase32(Buffer.alloc(5, 0xff))).toBe('77777777');
    expect(encodeBase32(Buffer.alloc(5, 0))).toBe('AAAAAAAA');
  });
});

describe('generateTotpSecret', () => {
  it('draws 20 random bytes, a new secret each time', () => {
    const first = generateTotpSecret();

    expect(first).toHaveLength(TOTP_SECRET_BYTES);
    expect(generateTotpSecret().equals(first)).toBe(false);
  });
});

describe('otpauthUri', () => {
  it('follows the Key URI Format, label and issuer URL-encoded', () => {
    expect(
      otpauthUri({ issuer: 'E-Deep', accountName: 'ops+1@example.test', secret: RFC_SECRET }),
    ).toBe(
      'otpauth://totp/E-Deep:ops%2B1%40example.test?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=E-Deep&algorithm=SHA1&digits=6&period=30',
    );
  });

  it('encodes an issuer with spaces or a colon', () => {
    expect(otpauthUri({ issuer: 'A B:C', accountName: 'x', secret: RFC_SECRET })).toMatch(
      /^otpauth:\/\/totp\/A%20B%3AC:x\?secret=[A-Z2-7]+&issuer=A%20B%3AC&/,
    );
  });
});
