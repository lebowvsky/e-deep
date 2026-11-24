import { applyDecorators } from '@nestjs/common';
import { isEmail, IsString, ValidateBy } from 'class-validator';
import { Required } from '../../../common/validation/field-rules';
import { EMAIL_MAX_LENGTH } from '../../accounts/email';
import { PASSWORD_MAX_LENGTH } from '../password/password-policy';

// Field rules of the credentials, shared by the authentication and account DTOs. Codes only,
// never the value (D-26).

/**
 * An email: a string of at most 254 characters (`length`, the `ck_accounts__email` bound) with
 * the syntax of an address once trimmed (`format`). `normalizeEmail` then applies what the
 * database needs (ASCII only, lower case).
 */
export function IsEmailAddress(): PropertyDecorator {
  return applyDecorators(
    Required(),
    IsString(),
    ValidateBy({
      name: 'length',
      constraints: [EMAIL_MAX_LENGTH],
      validator: { validate: (value: unknown) => !isString(value) || isShortEmail(value) },
    }),
    ValidateBy({
      name: 'format',
      validator: {
        validate: (value: unknown) =>
          !isString(value) || !isShortEmail(value) || isEmail(value.trim()),
      },
    }),
  );
}

/**
 * A password typed by the user, new or to check: a string of at most 128 characters (code points,
 * the D35 bound) as received, `too-long` otherwise. Measured raw, before any normalisation, so that
 * an oversized body never reaches Argon2id; the policy (`PasswordPolicy`) measures new passwords
 * again after NFKC. No lower bound here: the policy answers `too-short` for a new password, and an
 * empty password to check is simply wrong (`invalid-credentials`).
 */
export function IsPasswordInput(): PropertyDecorator {
  return applyDecorators(
    Required(),
    IsString(),
    ValidateBy({
      name: 'too-long',
      constraints: [PASSWORD_MAX_LENGTH],
      validator: { validate: (value: unknown) => !isString(value) || isShortPassword(value) },
    }),
  );
}

function isShortEmail(value: string): boolean {
  return value.length <= EMAIL_MAX_LENGTH;
}

function isShortPassword(value: string): boolean {
  // A code point takes at most two UTF-16 units: the bounds avoid spreading a huge string.
  if (value.length <= PASSWORD_MAX_LENGTH) {
    return true;
  }
  return value.length <= PASSWORD_MAX_LENGTH * 2 && [...value].length <= PASSWORD_MAX_LENGTH;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
