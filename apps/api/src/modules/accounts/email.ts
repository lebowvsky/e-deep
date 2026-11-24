import { DomainValidationError } from '../../common/errors/domain-errors';

/** Bounds of `ck_accounts__email` (`char_length` 3 to 254). */
export const EMAIL_MIN_LENGTH = 3;
export const EMAIL_MAX_LENGTH = 254;

/** Printable ASCII without space: what `lower` and `btrim` leave unchanged once lower-cased. */
const PRINTABLE_ASCII = /^[\x21-\x7e]+$/;

/**
 * The single normalisation of an email, used for every lookup, write and rate-limit key:
 * `trim` + lower case, as the `ck_accounts__email` CHECK expects (`email = lower(btrim(email))`).
 *
 * Beta limitation (user decision): only ASCII emails are accepted. JavaScript and PostgreSQL agree
 * on lower-casing ASCII whatever the collation, so the normalised value always passes the CHECK and
 * a malformed email is a `400`, never a 500. Internationalised emails (EAI, IDN in Unicode form)
 * are refused until a later lot decides their normalisation.
 *
 * Only what the database needs is checked here; the full email syntax is the DTO's (`IsEmailAddress`).
 *
 * @throws {DomainValidationError} `fieldErrors.email`: `invalid-character` (non-ASCII, space or
 *   control character), `length` (3 to 254) or `format` (no `@` after the first character).
 */
export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (!PRINTABLE_ASCII.test(email)) {
    throw invalidEmail(email.length === 0 ? 'length' : 'invalid-character');
  }
  if (email.length < EMAIL_MIN_LENGTH || email.length > EMAIL_MAX_LENGTH) {
    throw invalidEmail('length');
  }
  if (email.indexOf('@') < 1) {
    throw invalidEmail('format');
  }
  return email;
}

function invalidEmail(code: string): DomainValidationError {
  return new DomainValidationError({ email: [code] });
}
