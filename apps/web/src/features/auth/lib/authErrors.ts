// What a refused sign-in or sign-up becomes in the form (docs/plans/auth.md §3, accueil.md).
import { ApiError, type ApiFieldErrorCodes } from '@/shared/lib/apiClient';
import { formatRetryDelay } from '@/shared/lib/format';
import { AuthError } from '@/shared/session/authClient';

export type AuthField = 'firstName' | 'email' | 'password';

/** The values a submission was made with: a server message holds while its value is unchanged. */
export type SubmittedValues = Partial<Record<AuthField, string>>;

export interface FieldFailure {
  /** The value refused, as sent. */
  value: string;
  message: string;
}

export type SubmitFailure =
  /** Wrong e-mail or password: one message for both (no account enumeration). */
  | { code: 'invalid-credentials' }
  /** Throttled (D35); `until` in epoch ms from `Retry-After`, `null` when the API did not say. */
  | { code: 'too-many-attempts'; until: number | null }
  /** Closed beta (D39), though the front offered the form. */
  | { code: 'registration-closed' }
  | { code: 'email-taken'; email: string }
  /** Per-field refusals; `compromised` is the password found in the list of common ones. */
  | {
      code: 'invalid-fields';
      fields: Partial<Record<AuthField, FieldFailure>>;
      compromised: string | null;
    }
  /** No answer: network down, timeout. */
  | { code: 'network' }
  /** An answer, but not an expected one (5xx, unknown code, response off contract). */
  | { code: 'unexpected' };

const PASSWORD_MESSAGES: Record<string, string> = {
  'too-short': '15 caractères minimum.',
  'too-long': '128 caractères maximum.',
  compromised: 'Ce mot de passe est trop courant. Choisis-en un autre.',
  'contains-identity': 'Ton mot de passe ne doit pas contenir ton e-mail ni ton prénom.',
};

const FIELD_MESSAGES: Record<AuthField, string> = {
  firstName: 'Saisis un prénom de 1 à 40 caractères.',
  email: 'Saisis une adresse e-mail valide.',
  password: 'Ce mot de passe n’est pas accepté.',
};

const isAuthField = (field: string): field is AuthField => field in FIELD_MESSAGES;

function fieldsFailure(errors: ApiFieldErrorCodes, submitted: SubmittedValues): SubmitFailure {
  const fields: Partial<Record<AuthField, FieldFailure>> = {};
  for (const [field, codes] of Object.entries(errors)) {
    if (!isAuthField(field)) continue;
    const code = codes[0];
    const message =
      field === 'password' && code !== undefined
        ? (PASSWORD_MESSAGES[code] ?? FIELD_MESSAGES.password)
        : FIELD_MESSAGES[field];
    fields[field] = { value: submitted[field] ?? '', message };
  }
  // A refusal on a field the form does not have: nothing the diver can fix.
  if (Object.keys(fields).length === 0) return { code: 'unexpected' };
  const compromised = errors.password?.includes('compromised') ? (submitted.password ?? '') : null;
  return { code: 'invalid-fields', fields, compromised };
}

/**
 * The failure to show for `error`, thrown by `login` or `signup`. Rethrows what is neither an
 * `AuthError` nor an `ApiError`: a bug, for the error boundary, never swallowed here.
 */
export function toSubmitFailure(
  error: unknown,
  submitted: SubmittedValues,
  now: number,
): SubmitFailure {
  if (error instanceof AuthError) {
    const { failure } = error;
    switch (failure.code) {
      case 'invalid-credentials':
        return { code: 'invalid-credentials' };
      case 'too-many-attempts':
        return {
          code: 'too-many-attempts',
          until: failure.retryAfterS === null ? null : now + failure.retryAfterS * 1000,
        };
      case 'registration-closed':
        return { code: 'registration-closed' };
      case 'email-taken':
        return { code: 'email-taken', email: submitted.email ?? '' };
      case 'validation-failed':
        return fieldsFailure(failure.fieldErrors, submitted);
      case 'unauthenticated':
      case 'onboarding-complete':
        return { code: 'unexpected' };
    }
  }
  if (error instanceof ApiError) {
    return error.kind === 'network' || error.kind === 'timeout'
      ? { code: 'network' }
      : { code: 'unexpected' };
  }
  throw error;
}

/**
 * Text of the banner above the fields, `null` when there is none: no failure, a failure said on a
 * field, or a throttling whose delay is over (`retryLeft`, seconds, from `useCountdown`).
 */
export function bannerMessage(failure: SubmitFailure | null, retryLeft: number): string | null {
  switch (failure?.code) {
    case undefined:
      return null;
    case 'invalid-credentials':
      return 'E-mail ou mot de passe incorrect. Vérifie ta saisie ou réinitialise ton mot de passe.';
    case 'too-many-attempts':
      if (failure.until === null) return 'Trop de tentatives. Réessaie dans quelques minutes.';
      return retryLeft > 0
        ? `Trop de tentatives. Réessaie dans ${formatRetryDelay(retryLeft)}.`
        : null;
    case 'registration-closed':
      return 'Les inscriptions ne sont pas encore ouvertes.';
    case 'network':
      return 'Connexion impossible. Vérifie ton réseau et réessaie.';
    case 'unexpected':
      return 'Une erreur est survenue. Réessaie dans un instant.';
    case 'email-taken':
    case 'invalid-fields':
      return null;
  }
}

/** The server's message on `field`, while its value is still the one refused. */
export function serverFieldError(
  failure: SubmitFailure | null,
  field: AuthField,
  value: string,
): string | null {
  if (failure?.code !== 'invalid-fields') return null;
  const refused = failure.fields[field];
  return refused !== undefined && refused.value === value ? refused.message : null;
}
