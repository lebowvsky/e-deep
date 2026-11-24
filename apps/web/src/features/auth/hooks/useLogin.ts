import type { LoginRequest } from '@e-deep/shared';
import { useAuthServices } from '@/shared/session/hooks/useAuthServices';
import { useSessionMutation } from './useSessionMutation';

/**
 * `POST /api/auth/login`: its `/me` becomes the session of the cache. Rejects with an `AuthError`
 * (`invalid-credentials`, `too-many-attempts`…) or an `ApiError`. Unlike `useAuth`, it does not
 * read the session: the sign-in form has none to read.
 */
export function useLogin() {
  const { authClient } = useAuthServices();
  return useSessionMutation((request: LoginRequest) => authClient.login(request), {
    newSession: true,
  }).mutateAsync;
}
