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

/**
 * The session, `null` without one. `fetchQuery` rather than `ensureQueryData`: both reuse the
 * cached `/me` (`staleTime: Infinity`), but only `fetchQuery` calls the API again once it was
 * invalidated (a `403 consent-required` met on the way, see `createQueryClient`).
 *
 * No session: whatever the cache still holds belonged to it, and is dropped. Any other failure
 * (network, 5xx) rejects: the route shows its error element.
 */
export async function loadSession({
  queryClient,
  authClient,
}: SessionLoaderDependencies): Promise<MeResponse | null> {
  try {
    return await queryClient.fetchQuery(meQueryOptions(authClient));
  } catch (error) {
    if (sessionEventOf(error) !== 'unauthenticated') throw error;
    queryClient.clear();
    return null;
  }
}
