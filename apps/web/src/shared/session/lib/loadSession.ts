import type { MeResponse } from '@e-deep/shared';
import type { QueryClient } from '@tanstack/react-query';
import { meQueryOptions } from '../api/meApi';
import type { AuthClient } from '../authClient';
import { sessionEventOf } from './sessionErrors';

/** What the session loaders need: injected by `createRoutes`, never imported. */
export interface SessionLoaderDependencies {
  queryClient: QueryClient;
  authClient: AuthClient;
}

export interface LoadSessionOptions {
  /**
   * Gives up on `/me` after this delay (ms), shorter than the API client's own: the caller then
   * goes on without knowing the session (rejects). Without it, the API client's timeout applies.
   */
  timeoutMs?: number;
}

/** `/me`, cancelled after `timeoutMs` (a timer of the page, cleared once it settles). */
function meWithin(authClient: AuthClient, timeoutMs: number) {
  return async ({ signal }: { signal: AbortSignal }) => {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), timeoutMs);
    try {
      return await authClient.me({ signal: AbortSignal.any([signal, timeout.signal]) });
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * The session, `null` without one. `fetchQuery` rather than `ensureQueryData`: both reuse the
 * cached `/me` (`staleTime: Infinity`), but only `fetchQuery` calls the API again once it was
 * invalidated (a `403 consent-required` met on the way, see `createQueryClient`).
 *
 * No session: whatever the cache still holds belonged to it, and is dropped. Any other failure
 * (network, 5xx, `timeoutMs` reached) rejects: the route shows its error element, or the caller
 * decides.
 */
export async function loadSession(
  { queryClient, authClient }: SessionLoaderDependencies,
  { timeoutMs }: LoadSessionOptions = {},
): Promise<MeResponse | null> {
  const query = meQueryOptions(authClient);
  try {
    return await queryClient.fetchQuery(
      timeoutMs === undefined ? query : { ...query, queryFn: meWithin(authClient, timeoutMs) },
    );
  } catch (error) {
    if (sessionEventOf(error) !== 'unauthenticated') throw error;
    queryClient.clear();
    return null;
  }
}
