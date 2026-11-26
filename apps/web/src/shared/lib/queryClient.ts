import { MutationCache, QueryCache, QueryClient, type QueryKey } from '@tanstack/react-query';
import { ApiError } from './apiClient';

/** One retry at most: the API client already waits up to its own timeout on each attempt. */
const MAX_RETRIES = 1;

/**
 * Server data is only changed by this user's own actions (a dive write invalidates what it changes):
 * coming back to a page within this delay reuses the cache instead of calling the API again.
 */
const STALE_TIME_MS = 60_000;

/**
 * Retries only the failures that may be transient (network, timeout, HTTP 5xx). A 4xx or a body
 * that does not match the contract would fail the same way again.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES || !(error instanceof ApiError)) return false;
  if (error.kind === 'http') return (error.status ?? 0) >= 500;
  return error.kind === 'network' || error.kind === 'timeout';
}

/**
 * Meta of the queries that handle their own session errors (the session probe of the route
 * loaders, which redirect with the right `next`): `createQueryClient` leaves them alone.
 */
export const SELF_HANDLED_SESSION_META = { sessionProbe: true } as const;

/** What a failure says about the session (`SessionEvent` of `@/shared/session`). */
export type SessionErrorKind = 'unauthenticated' | 'profile-required' | 'consent-required';

/** How the query client reacts to session errors: given by the app, which knows the session. */
export interface SessionErrorPolicy {
  /** What `error` says about the session, `null` when nothing. */
  classify: (error: unknown) => SessionErrorKind | null;
  /** Prefix of the session queries, marked stale (not refetched) on an onboarding refusal. */
  sessionKey: QueryKey;
  /** No session any more (`401`): the cache is already cleared; go to `/login?next=…`. */
  onUnauthenticated: () => void;
  /**
   * `403 onboarding-required` / `consent-required` (D38): the session query is already marked
   * stale, so that the loader of `/welcome` or `/consent` reads the new status; go there.
   */
  onOnboardingRequired: (status: Exclude<SessionErrorKind, 'unauthenticated'>) => void;
}

/**
 * The reaction to a session found closed (`401`), whoever finds it (a query, a mutation, or a call
 * made outside the cache such as the account deletion, `endSession`): nothing of the logbook stays
 * in memory (D41), then `/login?next=…`.
 */
export function leaveLostSession(
  queryClient: QueryClient,
  policy: Pick<SessionErrorPolicy, 'onUnauthenticated'>,
): void {
  queryClient.clear();
  policy.onUnauthenticated();
}

/**
 * The query client of the app. With a `policy`, every failed query or mutation goes through it: a
 * `401` clears the whole cache, mutations included (the logbook of a closed session must not stay
 * in memory, D41). The queries marked `SELF_HANDLED_SESSION_META` are left to their caller.
 */
export function createQueryClient(policy?: SessionErrorPolicy): QueryClient {
  const handleSessionError = (error: unknown, meta: Record<string, unknown> | undefined) => {
    if (policy === undefined || meta?.sessionProbe === true) return;
    const kind = policy.classify(error);
    if (kind === null) return;
    if (kind === 'unauthenticated') {
      leaveLostSession(queryClient, policy);
      return;
    }
    // Marked stale without a refetch: the screen in place keeps its diver until it is left.
    void queryClient.invalidateQueries({ queryKey: policy.sessionKey, refetchType: 'none' });
    policy.onOnboardingRequired(kind);
  };

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => handleSessionError(error, query.meta),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => handleSessionError(error, mutation.meta),
    }),
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: STALE_TIME_MS,
        // Eco-design: no request when the tab regains focus; the data does not change behind the
        // user's back (single user, no sharing yet).
        refetchOnWindowFocus: false,
      },
    },
  });
  return queryClient;
}
