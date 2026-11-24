import type { ConsentGrantRequest } from '@e-deep/shared';
import { useAuthServices } from '@/shared/session/hooks/useAuthServices';
import { useSessionMutation } from './useSessionMutation';

/** `POST /api/me/consents` (`/consent`, D38): the answered `/me` replaces the cached one. */
export function useGrantConsent() {
  const { authClient } = useAuthServices();
  return useSessionMutation((request: ConsentGrantRequest) => authClient.grantConsent(request), {
    newSession: false,
  });
}
