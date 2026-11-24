import { ApiError } from '@/shared/lib/apiClient';
import type { SessionErrorKind } from '@/shared/lib/queryClient';
import { isAuthFailure } from '../authClient';

/**
 * What an API failure says about the session: none left (`401`), or a profile that must go through
 * onboarding again (`403 onboarding-required` / `consent-required`, D38). `null` for anything else.
 *
 * A `401 invalid-credentials` is a wrong password typed in a form, not a lost session.
 */
export type SessionEvent = SessionErrorKind;

export function sessionEventOf(error: unknown): SessionEvent | null {
  if (isAuthFailure(error, 'unauthenticated')) return 'unauthenticated';
  if (!(error instanceof ApiError) || error.kind !== 'http') return null;
  if (error.status === 401) return error.code === 'invalid-credentials' ? null : 'unauthenticated';
  if (error.status !== 403) return null;
  if (error.code === 'onboarding-required') return 'profile-required';
  return error.code === 'consent-required' ? 'consent-required' : null;
}
