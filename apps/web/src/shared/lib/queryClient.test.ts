import { describe, expect, it } from 'vitest';
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
