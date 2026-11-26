import type { RegisterRequest } from '@e-deep/shared';
import { useAuthServices } from '@/shared/session/hooks/useAuthServices';
import { useSessionMutation } from './useSessionMutation';

/**
 * `POST /api/auth/register`: the new session (`profile-required`) becomes the session of the
 * cache. Rejects with an `AuthError` (`email-taken`, `registration-closed`, `validation-failed`…)
 * or an `ApiError`.
 */
export function useSignup() {
  const { authClient } = useAuthServices();
  return useSessionMutation((request: RegisterRequest) => authClient.signup(request), {
    newSession: true,
  }).mutateAsync;
}
