import type { LoginRequest, MeResponse, RegisterRequest } from '@e-deep/shared';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { meQueryOptions } from '@/shared/session/api/meApi';
import { isAuthFailure } from '@/shared/session/authClient';
import { useAuthServices } from '@/shared/session/hooks/useAuthServices';
import { useSessionMutation } from './useSessionMutation';

/** The session as the public pages see it. `unknown`: `/me` failed for another reason (network). */
export type SessionState =
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; me: MeResponse }
  | { status: 'unknown' };

export interface Auth {
  session: SessionState;
  /** Rejects with an `AuthError` (`invalid-credentials`, `too-many-attempts`…) or an `ApiError`. */
  login: (request: LoginRequest) => Promise<MeResponse>;
  /** Rejects with an `AuthError` (`email-taken`, `registration-closed`…) or an `ApiError`. */
  signup: (request: RegisterRequest) => Promise<MeResponse>;
  /** Ends the session: cache emptied, device data erased, other tabs told (D41). */
  logout: () => Promise<void>;
}

/**
 * The session and its commands, over TanStack Query (D41): no state of its own, `/me` stays the
 * single source. The protected screens read the diver with `useCurrentDiver` instead.
 */
export function useAuth(): Auth {
  const { authClient, broadcast, purgeDeviceData } = useAuthServices();
  const queryClient = useQueryClient();
  const me = useQuery(meQueryOptions(authClient));
  const login = useSessionMutation((request: LoginRequest) => authClient.login(request), {
    newSession: true,
  });
  const signup = useSessionMutation((request: RegisterRequest) => authClient.signup(request), {
    newSession: true,
  });
  const logout = useMutation({
    mutationFn: () => authClient.logout(),
    onSuccess: () => {
      // Queries and mutations: the bodies of the dive writes are health data too.
      queryClient.clear();
      purgeDeviceData();
      broadcast.announceLogout();
    },
  });

  return {
    session: sessionStateOf(me),
    login: login.mutateAsync,
    signup: signup.mutateAsync,
    logout: logout.mutateAsync,
  };
}

function sessionStateOf({
  data,
  error,
}: Pick<UseQueryResult<MeResponse>, 'data' | 'error'>): SessionState {
  if (data !== undefined) return { status: 'signed-in', me: data };
  if (error === null) return { status: 'loading' };
  return isAuthFailure(error, 'unauthenticated') ? { status: 'signed-out' } : { status: 'unknown' };
}
