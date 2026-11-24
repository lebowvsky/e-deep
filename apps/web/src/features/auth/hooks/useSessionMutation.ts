import type { MeResponse } from '@e-deep/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionKeys } from '@/shared/session/api/meApi';

/**
 * A call that answers the new `/me` (login, sign-up, onboarding, consent): its answer becomes the
 * session in the cache, without calling `/me` again. `newSession`: another session starts, so
 * whatever the cache held is dropped first, queries and mutations (another diver's logbook, the
 * bodies of their writes) alike.
 */
export function useSessionMutation<TRequest>(
  call: (request: TRequest) => Promise<MeResponse>,
  { newSession }: { newSession: boolean },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: call,
    onSuccess: (me) => {
      if (newSession) queryClient.clear();
      queryClient.setQueryData(sessionKeys.me(), me);
    },
  });
}
