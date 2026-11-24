import type { OnboardingRequest } from '@e-deep/shared';
import { useAuthServices } from '@/shared/session/hooks/useAuthServices';
import { useSessionMutation } from './useSessionMutation';

/** `POST /api/me/onboarding` (`/welcome`, D38): the answered `/me` replaces the cached one. */
export function useCompleteOnboarding() {
  const { authClient } = useAuthServices();
  return useSessionMutation(
    (request: OnboardingRequest) => authClient.completeOnboarding(request),
    { newSession: false },
  );
}
