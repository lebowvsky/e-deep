import type { ChangePasswordRequest } from '@e-deep/shared';
import { useMutation } from '@tanstack/react-query';
import { useAuthServices } from '@/shared/session/hooks/useAuthServices';

/**
 * `PUT /api/me/password` (`/settings`): the session goes on, `/me` does not change. A mutation, so
 * that a session lost meanwhile (`401`) goes through the app's session policy.
 */
export function useChangePassword() {
  const { authClient } = useAuthServices();
  return useMutation({
    mutationFn: (request: ChangePasswordRequest) => authClient.changePassword(request),
  }).mutateAsync;
}
