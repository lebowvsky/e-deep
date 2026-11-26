import { ApiError } from '@/shared/lib/apiClient';

export type LoginFailure =
  /** Wrong e-mail, password or code, or not a staff account: one answer for all (no enumeration). */
  | { code: 'invalid-credentials' }
  /** Throttled; `until` in epoch ms from `Retry-After`, `null` when the API did not say. */
  | { code: 'too-many-attempts'; until: number | null; retryIn: string | null }
  /** No answer: network down, timeout. */
  | { code: 'network' }
  /** An answer, but not an expected one (5xx, another 4xx, response off contract). */
  | { code: 'unexpected' };

/** « 2 min », « 45 s »: the wait, said once in the banner (the button counts down). */
export function formatRetryDelay(seconds: number): string {
  return seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} s`;
}

/** « 2:05 », « 0:09 ». */
export function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * What a failed `POST /api/admin/auth/login` becomes on screen. Rethrows what is not an
 * `ApiError`: a bug, for the error element, never swallowed here.
 */
export function toLoginFailure(error: unknown, now: number): LoginFailure {
  if (!(error instanceof ApiError)) throw error;
  switch (error.kind) {
    case 'network':
    case 'timeout':
      return { code: 'network' };
    case 'invalid-response':
      return { code: 'unexpected' };
    case 'http':
      if (error.status === 401) return { code: 'invalid-credentials' };
      if (error.status === 429) {
        const { retryAfterS } = error;
        return retryAfterS === undefined
          ? { code: 'too-many-attempts', until: null, retryIn: null }
          : {
              code: 'too-many-attempts',
              until: now + retryAfterS * 1000,
              retryIn: formatRetryDelay(retryAfterS),
            };
      }
      return { code: 'unexpected' };
  }
}

/**
 * Text of the banner above the fields, `null` when there is none (no failure, or a throttling
 * whose delay is over: `retryLeft`, seconds, only decides whether the banner stays).
 */
export function loginBannerMessage(failure: LoginFailure | null, retryLeft: number): string | null {
  switch (failure?.code) {
    case undefined:
      return null;
    case 'invalid-credentials':
      return 'Identifiants incorrects. Vérifiez l’e-mail, le mot de passe et le code, puis réessayez.';
    case 'too-many-attempts':
      if (failure.retryIn === null) return 'Trop de tentatives. Réessayez dans quelques minutes.';
      return retryLeft > 0 ? `Trop de tentatives. Réessayez dans ${failure.retryIn}.` : null;
    case 'network':
      return 'Le serveur est injoignable. Vérifiez votre connexion et réessayez.';
    case 'unexpected':
      return 'Une erreur est survenue. Réessayez dans un instant.';
  }
}
