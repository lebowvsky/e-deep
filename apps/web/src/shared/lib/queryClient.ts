import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './apiClient';

/** One retry at most: the API client already waits up to its own timeout on each attempt. */
const MAX_RETRIES = 1;

/**
 * Server data is only changed by this user's own actions (future mutations will invalidate it):
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

export function createQueryClient(): QueryClient {
  return new QueryClient({
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
}
