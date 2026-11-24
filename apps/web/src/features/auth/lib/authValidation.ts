// Checks of the sign-in and sign-up forms before anything is sent: messages in French, `null` when
// the value is fine. The API checks again (D35), its answers are mapped by `authErrors.ts`.
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordLength } from './passwordRules';

export const FIRST_NAME_MAX_LENGTH = 40;

/** Something, an `@`, something, a dot, something: the API has the last word. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailError(email: string): string | null {
  const value = email.trim();
  if (value === '') return 'Saisis ton adresse e-mail.';
  return EMAIL_SHAPE.test(value)
    ? null
    : 'Saisis une adresse e-mail valide, par exemple nom@exemple.fr.';
}

export function firstNameError(firstName: string): string | null {
  const length = [...firstName.trim()].length;
  if (length === 0) return 'Saisis ton prénom.';
  return length > FIRST_NAME_MAX_LENGTH ? `${FIRST_NAME_MAX_LENGTH} caractères maximum.` : null;
}

/** Sign-in: any password is tried, as long as there is one. */
export function currentPasswordError(password: string): string | null {
  return password === '' ? 'Saisis ton mot de passe.' : null;
}

/** Sign-up: the length of D35. */
export function newPasswordError(password: string): string | null {
  const length = passwordLength(password);
  if (length < PASSWORD_MIN_LENGTH) return `${PASSWORD_MIN_LENGTH} caractères minimum.`;
  return length > PASSWORD_MAX_LENGTH ? `${PASSWORD_MAX_LENGTH} caractères maximum.` : null;
}
