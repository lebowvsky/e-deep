import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, MAX_RETRY_AFTER_S, parseRetryAfter } from './apiClient';

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

  it('sends the session cookie of the origin with every call', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(Response.json({ value: 1 })));

    await client.get('numbers', isNumberBody);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: 'GET',
      credentials: 'same-origin',
    });
  });
});

describe('createApiClient · post', () => {
  it('sends the body as JSON and returns the validated answer', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(Response.json({ value: 7 })));

    await expect(client.post('/numbers', { value: 7 }, isNumberBody)).resolves.toEqual({
      value: 7,
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toEqual(new URL('http://api.test/api/numbers'));
    expect(init).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ value: 7 }),
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
  });

  it('sends nothing and ignores the empty answer of postNoContent', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response(null, { status: 204 })));

    await expect(client.postNoContent('/logout')).resolves.toBeUndefined();
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
    expect(init?.body).toBeUndefined();
  });

  it('reads the code and field errors of an error body', async () => {
    stubFetch(() =>
      Promise.resolve(
        Response.json(
          { statusCode: 400, code: 'validation-failed', fieldErrors: { email: ['invalid'] } },
          { status: 400 },
        ),
      ),
    );

    await expect(client.post('/numbers', {}, isNumberBody)).rejects.toMatchObject({
      kind: 'http',
      status: 400,
      code: 'validation-failed',
      fieldErrors: { email: ['invalid'] },
    });
  });

  it('ignores an error body off contract', async () => {
    stubFetch(() =>
      Promise.resolve(Response.json({ code: 42, fieldErrors: { email: 'x' } }, { status: 400 })),
    );

    const error: unknown = await client.post('/n', {}, isNumberBody).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 400, code: undefined, fieldErrors: undefined });
  });

  it('reads Retry-After on a 429', async () => {
    stubFetch(() =>
      Promise.resolve(
        Response.json(
          { statusCode: 429, code: 'too-many-attempts' },
          { status: 429, headers: { 'Retry-After': '120' } },
        ),
      ),
    );

    await expect(client.post('/login', {}, isNumberBody)).rejects.toMatchObject({
      status: 429,
      code: 'too-many-attempts',
      retryAfterS: 120,
    });
  });
});

describe('createApiClient · session errors', () => {
  it.each([
    [401, 'unauthenticated'],
    [403, 'forbidden'],
  ])('reports a %i as %s, once, and still rejects', async (status, event) => {
    const onSessionError = vi.fn();
    const sessionClient = createApiClient({ baseUrl: 'http://api.test/api', onSessionError });
    const fetchMock = stubFetch(() => Promise.resolve(new Response(null, { status })));

    await expect(sessionClient.get('numbers', isNumberBody)).rejects.toMatchObject({ status });
    expect(onSessionError).toHaveBeenCalledExactlyOnceWith(event);
    // Never retried.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports nothing for another status', async () => {
    const onSessionError = vi.fn();
    const sessionClient = createApiClient({ baseUrl: 'http://api.test/api', onSessionError });
    stubFetch(() => Promise.resolve(new Response(null, { status: 500 })));

    await expect(sessionClient.get('numbers', isNumberBody)).rejects.toBeInstanceOf(ApiError);
    expect(onSessionError).not.toHaveBeenCalled();
  });
});

describe('parseRetryAfter', () => {
  const now = Date.parse('2026-11-27T10:00:00.000Z');

  it.each([
    ['120', 120],
    [' 5 ', 5],
    ['0', 0],
  ])('reads the delay %j', (value, expected) => {
    expect(parseRetryAfter(value, now)).toBe(expected);
  });

  it('reads an HTTP date as the seconds left', () => {
    expect(parseRetryAfter('Fri, 27 Nov 2026 10:01:30 GMT', now)).toBe(90);
  });

  it('gives 0 for a date already past', () => {
    expect(parseRetryAfter('Fri, 27 Nov 2026 09:00:00 GMT', now)).toBe(0);
  });

  it('caps a very long wait', () => {
    expect(parseRetryAfter('999999', now)).toBe(MAX_RETRY_AFTER_S);
  });

  it.each([null, '', 'soon', '-5', '1.5', 'Friday, 27-Nov-26 10:01:30 GMT'])(
    'ignores %j',
    (value) => {
      expect(parseRetryAfter(value, now)).toBeUndefined();
    },
  );
});
