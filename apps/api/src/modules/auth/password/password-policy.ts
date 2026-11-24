import type { PasswordPolicyFailure } from '@e-deep/shared';
import { DomainValidationError } from '../../../common/errors/domain-errors';
import { toComparablePassword } from './compromised-passwords';

/** D35, NIST 800-63B rev. 4: at least 15 characters for a single factor, at least 64 accepted. */
export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Shortest identity fragment looked for in a password. Shorter fragments (« Al », « Jo », a 2-letter
 * local part) appear by chance in too many good passwords to be refused.
 */
export const IDENTITY_FRAGMENT_MIN_LENGTH = 3;

/** What the password must not contain. `lastName` is unknown at sign-up. */
export interface PasswordIdentity {
  /** Normalised email (`normalizeEmail`). */
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string | null;
}

/** Field of the request that carries the new password, for `fieldErrors`. */
export type PasswordField = 'password' | 'newPassword';

/**
 * Password policy of D35: 15 to 128 characters (code points) after NFKC normalisation, no
 * composition rule, not in the local compromised list, and not containing the identity.
 *
 * Identity rule: refused when the password, NFKC-normalised and lower-cased, contains the full
 * email, its local part, or the first or last name (each also split on spaces, hyphens and
 * apostrophes: « Jean-Pierre » gives « jean-pierre », « jean » and « pierre »), for every fragment
 * of at least 3 code points.
 *
 * Results are codes only, never the value (D-26).
 */
export class PasswordPolicy {
  constructor(private readonly compromisedPasswords: ReadonlySet<string>) {}

  /** Every rule the candidate breaks; empty when it is acceptable. */
  check(candidate: string, identity: PasswordIdentity): PasswordPolicyFailure[] {
    const comparable = toComparablePassword(candidate);
    const length = [...candidate.normalize('NFKC')].length;
    const failures: PasswordPolicyFailure[] = [];
    if (length < PASSWORD_MIN_LENGTH) {
      failures.push('too-short');
    }
    if (length > PASSWORD_MAX_LENGTH) {
      failures.push('too-long');
    }
    if (this.compromisedPasswords.has(comparable)) {
      failures.push('compromised');
    }
    if (identityFragments(identity).some((fragment) => comparable.includes(fragment))) {
      failures.push('contains-identity');
    }
    return failures;
  }

  /** @throws {DomainValidationError} `400 validation-failed` with `fieldErrors[field]`. */
  assertAcceptable(candidate: string, identity: PasswordIdentity, field: PasswordField): void {
    const failures = this.check(candidate, identity);
    if (failures.length > 0) {
      throw new DomainValidationError({ [field]: failures });
    }
  }
}

function identityFragments({ email, firstName, lastName }: PasswordIdentity): string[] {
  const localPart = email.slice(0, email.lastIndexOf('@'));
  const names = [firstName, lastName ?? ''].flatMap((name) => {
    const whole = toComparablePassword(name.trim());
    return [whole, ...whole.split(/[\s'’-]+/u)];
  });
  return [toComparablePassword(email), toComparablePassword(localPart), ...names].filter(
    (fragment) => [...fragment].length >= IDENTITY_FRAGMENT_MIN_LENGTH,
  );
}
