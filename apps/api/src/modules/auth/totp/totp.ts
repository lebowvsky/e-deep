import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Time-based one-time passwords of the staff (RFC 6238, D42), natively: HMAC-SHA1, 30-second
 * steps, 6 digits, ±1 step of tolerance for the clock drift of the authenticator. Pure functions:
 * the caller gives the instant, and enforces the anti-replay with the step a code matched (RFC 6238
 * §5.2). Nothing here logs.
 */
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW_STEPS = 1;
/** 160 bits, the HMAC-SHA1 block output length recommended by RFC 4226 §4. */
export const TOTP_SECRET_BYTES = 20;

const PERIOD_MS = TOTP_PERIOD_SECONDS * 1000;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** A new random secret, to be encrypted before it is stored (`TotpSecretCipher`). */
export function generateTotpSecret(): Buffer {
  return randomBytes(TOTP_SECRET_BYTES);
}

/** The time step (`T` of RFC 6238) that contains `instant`. */
export function totpStepAt(instant: Date): number {
  return Math.floor(instant.getTime() / PERIOD_MS);
}

/**
 * HOTP value of `counter` (RFC 4226 §5.3: dynamic truncation), zero-padded to `digits`. The
 * digits are a parameter for the RFC test vectors (8 digits); the staff codes use `TOTP_DIGITS`.
 */
export function hotp(secret: Uint8Array, counter: number, digits: number = TOTP_DIGITS): string {
  if (!Number.isSafeInteger(counter) || counter < 0) {
    throw new RangeError('HOTP counter must be a non-negative safe integer');
  }
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', secret).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/**
 * The step of the window around `at` whose code is `code`, or `null`. Every candidate of the
 * window is computed and compared in constant time, without early exit. On the (1 in 10^6)
 * collision of two steps, the oldest is returned: it never consumes a step ahead of the clock.
 *
 * The caller must still refuse a step already accepted (anti-replay), atomically.
 */
export function matchTotpStep(
  secret: Uint8Array,
  code: string,
  at: Date,
  digits: number = TOTP_DIGITS,
): number | null {
  if (code.length !== digits || !/^\d+$/.test(code)) {
    return null;
  }
  const submitted = Buffer.from(code, 'ascii');
  const current = totpStepAt(at);
  let matched: number | null = null;
  for (let step = current - TOTP_WINDOW_STEPS; step <= current + TOTP_WINDOW_STEPS; step += 1) {
    const expected = Buffer.from(hotp(secret, step, digits), 'ascii');
    const equal = timingSafeEqual(expected, submitted);
    if (equal && matched === null) {
      matched = step;
    }
  }
  return matched;
}

/** Base32 of RFC 4648 §6, upper case, without padding (the form authenticator apps expect). */
export function encodeBase32(bytes: Uint8Array): string {
  let output = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET.charAt((buffer >>> bits) & 0x1f);
    }
    // Only the bits not yet encoded are kept: the buffer never exceeds 12 bits.
    buffer &= (1 << bits) - 1;
  }
  if (bits > 0) {
    output += BASE32_ALPHABET.charAt((buffer << (5 - bits)) & 0x1f);
  }
  return output;
}

export interface OtpauthUriInput {
  readonly issuer: string;
  /** Shown by the authenticator app next to the issuer (the staff email). */
  readonly accountName: string;
  readonly secret: Uint8Array;
}

/**
 * Enrolment URI of the Key URI Format (`otpauth://totp/…`), read by the authenticator apps. It
 * carries the secret in clear: printed once to the operator, never logged nor stored.
 */
export function otpauthUri({ issuer, accountName, secret }: OtpauthUriInput): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`;
  const parameters = [
    `secret=${encodeBase32(secret)}`,
    `issuer=${encodeURIComponent(issuer)}`,
    'algorithm=SHA1',
    `digits=${TOTP_DIGITS}`,
    `period=${TOTP_PERIOD_SECONDS}`,
  ];
  return `otpauth://totp/${label}?${parameters.join('&')}`;
}
