import type { MeResponse } from '@e-deep/shared';
import { useQuery } from '@tanstack/react-query';
import { meQueryOptions } from '../api/meApi';
import { useAuthServices } from './useAuthServices';

/**
 * The whole `/me` (account, consent, onboarding status), for the onboarding and account screens.
 * Like `useCurrentDiver`, it only reads what the route loader put in the cache, and keeps the last
 * known value once the session ends under a mounted screen (the cache is cleared before leaving).
 */
export function useMe(): MeResponse {
  const { authClient } = useAuthServices();
  const { data } = useQuery({
    ...meQueryOptions(authClient),
    enabled: false,
    placeholderData: (previous) => previous,
  });
  if (data === undefined) {
    throw new Error('useMe needs a session: render it under a session loader.');
  }
  return data;
}
