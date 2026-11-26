import { hotp, totpStepAt } from '../../src/modules/auth/totp/totp';

// What the authenticator app of a staff member does with the enrolment URI printed by
// `account:create-staff` / `account:reset-totp`: decode its secret, show the code of a step.

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** The `otpauth://` line of a command output (fails the test when there is not exactly one). */
export function otpauthUriIn(output: string): string {
  const uris = output.split('\n').filter((line) => line.startsWith('otpauth://'));
  if (uris.length !== 1 || uris[0] === undefined) {
    throw new Error('Expected exactly one otpauth URI');
  }
  return uris[0];
}

/** The secret of an `otpauth://` URI (Base32 of RFC 4648, without padding). */
export function secretOf(uri: string): Buffer {
  const encoded = new URL(uri).searchParams.get('secret') ?? '';
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of encoded) {
    const value = BASE32_ALPHABET.indexOf(character);
    if (value === -1) {
      throw new Error('Invalid Base32 secret');
    }
    buffer = ((buffer << 5) | value) & 0xfff;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 0xff);
    }
  }
  return Buffer.from(bytes);
}

/** The code the authenticator shows at `at`, `offsetSteps` steps later (or earlier). */
export function authenticatorCode(uri: string, at: Date, offsetSteps = 0): string {
  return hotp(secretOf(uri), totpStepAt(at) + offsetSteps);
}
