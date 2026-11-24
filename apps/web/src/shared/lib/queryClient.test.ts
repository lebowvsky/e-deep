import { describe, expect, it, vi } from 'vitest';
import { sessionKeys } from '@/shared/session/api/meApi';
import { AuthError } from '@/shared/session/authClient';
import { sessionEventOf } from '@/shared/session/lib/sessionErrors';
import { ME_FIXTURE } from '@/shared/session/mocks/me';
import { ApiError } from './apiClient';
import { createQueryClient, shouldRetry } from './queryClient';

const network = new ApiError('network', 'The API is unreachable.');
const timeout = new ApiError('timeout', 'The API did not answer.');
const http = (status: number) => new ApiError('http', `HTTP ${status}`, { status });
const invalid = new ApiError('invalid-response', 'Unexpected response shape.');

describe('shouldRetry', () => {
  it.each([
    ['a network error', network],
    ['a timeout', timeout],
    ['an HTTP 500', http(500)],
    ['an HTTP 503', http(503)],
  ])('retries %s once', (_label, error) => {
    expect(shouldRetry(0, error)).toBe(true);
  });

  it.each([
    ['a network error', network],
    ['a timeout', timeout],
    ['an HTTP 500', http(500)],
  ])('does not retry %s a second time', (_label, error) => {
    expect(shouldRetry(1, error)).toBe(false);
    expect(shouldRetry(2, error)).toBe(false);
  });

  it.each([
    ['an HTTP 400', http(400)],
    ['an HTTP 401', http(401)],
    ['an HTTP 404', http(404)],
    // Refusals of a write: retrying would only get the same answer (writes do not go through
    // `useQuery` anyway).
    [
      'a 400 validation-failed',
      new ApiError('http', 'HTTP 400', { status: 400, code: 'validation-failed', fieldErrors: {} }),
    ],
    [
      'a 409 identifier-conflict',
      new ApiError('http', 'HTTP 409', { status: 409, code: 'identifier-conflict' }),
    ],
    [
      'a 422 invalid-reference',
      new ApiError('http', 'HTTP 422', { status: 422, code: 'invalid-reference' }),
    ],
    ['an invalid response', invalid],
    ['an http error without status', new ApiError('http', 'HTTP ?')],
    ['an error that is not an ApiError', new TypeError('boom')],
    ['a caller abort', new DOMException('Aborted', 'AbortError')],
  ])('never retries %s', (_label, error) => {
    expect(shouldRetry(0, error)).toBe(false);
  });
});

describe('createQueryClient', () => {
  it('applies the retry policy, a stale time and no refetch on focus', () => {
    const { queries } = createQueryClient().getDefaultOptions();
    expect(queries?.retry).toBe(shouldRetry);
    expect(queries?.staleTime).toBe(60_000);
    expect(queries?.refetchOnWindowFocus).toBe(false);
  });

  it('gives each call its own cache', () => {
    expect(createQueryClient().getQueryCache()).not.toBe(createQueryClient().getQueryCache());
  });
});

describe('createQueryClient — session errors', () => {
  const LOG_KEY = ['dives', 'log'];

  function setup() {
    const onUnauthenticated = vi.fn();
    const onOnboardingRequired = vi.fn();
    const queryClient = createQueryClient({
      classify: sessionEventOf,
      sessionKey: sessionKeys.all,
      onUnauthenticated,
      onOnboardingRequired,
    });
    queryClient.setQueryData(sessionKeys.me(), ME_FIXTURE);
    queryClient.setQueryData(['dashboard'], { cached: true });
    return { queryClient, onUnauthenticated, onOnboardingRequired };
  }

  const failWith = (error: Error) => () => Promise.reject(error);

  it('clears the whole cache on a 401 of a query, then calls onUnauthenticated', async () => {
    const { queryClient, onUnauthenticated, onOnboardingRequired } = setup();

    await queryClient
      .fetchQuery({ queryKey: LOG_KEY, queryFn: failWith(http(401)), retry: false })
      .catch(() => undefined);

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(onUnauthenticated).toHaveBeenCalledOnce();
    expect(onOnboardingRequired).not.toHaveBeenCalled();
  });

  it('ignores session errors without a policy (tests, tools)', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(['dashboard'], { cached: true });

    await queryClient
      .fetchQuery({ queryKey: LOG_KEY, queryFn: failWith(http(401)), retry: false })
      .catch(() => undefined);

    expect(queryClient.getQueryData(['dashboard'])).toEqual({ cached: true });
  });

  it('does the same on a 401 of a mutation, and drops the other mutations too', async () => {
    const { queryClient, onUnauthenticated } = setup();
    const mutation = queryClient.getMutationCache().build(queryClient, {
      mutationFn: failWith(
        new ApiError('http', 'HTTP 401', { status: 401, code: 'unauthenticated' }),
      ),
    });

    await mutation.execute(undefined).catch(() => undefined);

    expect(queryClient.getQueryData(sessionKeys.me())).toBeUndefined();
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    expect(onUnauthenticated).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'a wrong password',
      new ApiError('http', 'HTTP 401', { status: 401, code: 'invalid-credentials' }),
    ],
    ['a 403 forbidden', new ApiError('http', 'HTTP 403', { status: 403, code: 'forbidden' })],
    ['a 404', http(404)],
    ['a network error', network],
  ])('keeps the cache on %s', async (_label, error) => {
    const { queryClient, onUnauthenticated, onOnboardingRequired } = setup();

    await queryClient
      .fetchQuery({ queryKey: LOG_KEY, queryFn: failWith(error), retry: false })
      .catch(() => undefined);

    expect(queryClient.getQueryData(sessionKeys.me())).toEqual(ME_FIXTURE);
    expect(onUnauthenticated).not.toHaveBeenCalled();
    expect(onOnboardingRequired).not.toHaveBeenCalled();
  });

  it('leaves the session probe (/me in the loaders) to its caller', async () => {
    const { queryClient, onUnauthenticated } = setup();

    await queryClient
      .fetchQuery({
        queryKey: ['session', 'probe'],
        queryFn: failWith(new AuthError({ code: 'unauthenticated' })),
        meta: { sessionProbe: true },
        retry: false,
      })
      .catch(() => undefined);

    expect(queryClient.getQueryData(['dashboard'])).toEqual({ cached: true });
    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it.each([
    ['onboarding-required', 'profile-required'],
    ['consent-required', 'consent-required'],
  ])('marks /me stale on a 403 %s and asks for %s', async (code, status) => {
    const { queryClient, onUnauthenticated, onOnboardingRequired } = setup();

    await queryClient
      .fetchQuery({
        queryKey: LOG_KEY,
        queryFn: failWith(new ApiError('http', 'HTTP 403', { status: 403, code })),
        retry: false,
      })
      .catch(() => undefined);

    expect(onOnboardingRequired).toHaveBeenCalledWith(status);
    expect(onUnauthenticated).not.toHaveBeenCalled();
    // Still on screen until the page is left, but read again by the next loader.
    expect(queryClient.getQueryData(sessionKeys.me())).toEqual(ME_FIXTURE);
    expect(queryClient.getQueryState(sessionKeys.me())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryData(['dashboard'])).toEqual({ cached: true });
  });
});
