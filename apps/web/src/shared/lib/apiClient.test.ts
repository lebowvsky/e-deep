import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './apiClient';

const isNumberBody = (value: unknown): value is { value: number } =>
  typeof value === 'object' &&
  value !== null &&
  'value' in value &&
  typeof value.value === 'number';

function stubFetch(implementation: typeof fetch) {
  const fetchMock = vi.fn<typeof fetch>(implementation);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const client = createApiClient({ baseUrl: 'http://api.test/api' });

describe('createApiClient', () => {
  it('resolves the path against the base URL and returns the validated body', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(Response.json({ value: 42 })));

    await expect(client.get('/numbers', isNumberBody)).resolves.toEqual({ value: 42 });
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL('http://api.test/api/numbers'));
  });

  it('rejects with an http ApiError on a non-2xx status', async () => {
    stubFetch(() => Promise.resolve(new Response(null, { status: 503 })));

    await expect(client.get('numbers', isNumberBody)).rejects.toMatchObject({
      kind: 'http',
      status: 503,
    });
  });

  it('rejects with an invalid-response ApiError when the body fails the guard', async () => {
    stubFetch(() => Promise.resolve(Response.json({ value: 'nope' })));

    await expect(client.get('numbers', isNumberBody)).rejects.toMatchObject({
      kind: 'invalid-response',
    });
  });

  it('rejects with a network ApiError when fetch fails', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    const error: unknown = await client.get('numbers', isNumberBody).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'network' });
  });
});
