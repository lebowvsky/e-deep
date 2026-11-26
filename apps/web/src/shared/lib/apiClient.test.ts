import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient, isApiHttpError, parseRetryAfter } from './apiClient';

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

/** The `init` of the first `fetch` call. */
function initOf(fetchMock: ReturnType<typeof stubFetch>): RequestInit {
  const init = fetchMock.mock.calls[0]?.[1];
  if (!init) throw new Error('fetch was not called with an init');
  return init;
}

describe('createApiClient — writes', () => {
  it.each(['post', 'put'] as const)(
    'sends the body as JSON with %s and returns the validated body',
    async (method) => {
      const fetchMock = stubFetch(() =>
        Promise.resolve(Response.json({ value: 7 }, { status: 201 })),
      );

      await expect(client[method]('numbers/1', { a: 1 }, isNumberBody)).resolves.toEqual({
        value: 7,
      });
      expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL('http://api.test/api/numbers/1'));
      const init = initOf(fetchMock);
      expect(init.method).toBe(method.toUpperCase());
      expect(init.body).toBe('{"a":1}');
      expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
      expect(new Headers(init.headers).get('Accept')).toBe('application/json');
      expect(init.signal).toBeInstanceOf(AbortSignal);
    },
  );

  it('sends a GET without body nor Content-Type', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(Response.json({ value: 42 })));

    await client.get('numbers', isNumberBody);
    const init = initOf(fetchMock);
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
  });

  it('sends a DELETE without body and resolves on an empty 204', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response(null, { status: 204 })));

    await expect(client.delete('sites/s1')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL('http://api.test/api/sites/s1'));
    const init = initOf(fetchMock);
    expect(init.method).toBe('DELETE');
    expect(init.body).toBeUndefined();
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('sends a POST without body and resolves on an empty 204', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response(null, { status: 204 })));

    await expect(client.postNoContent('auth/logout')).resolves.toBeUndefined();
    const init = initOf(fetchMock);
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
  });

  it('sends a DELETE with a JSON body when given one', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response(null, { status: 204 })));

    await expect(client.delete('me', { body: { password: 'p' } })).resolves.toBeUndefined();
    const init = initOf(fetchMock);
    expect(init.method).toBe('DELETE');
    expect(init.body).toBe(JSON.stringify({ password: 'p' }));
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('sends a PUT with a JSON body and resolves on an empty 204', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(new Response(null, { status: 204 })));

    await expect(client.putNoContent('me/password', { a: 1 })).resolves.toBeUndefined();
    const init = initOf(fetchMock);
    expect(init.method).toBe('PUT');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it('reads the code of a refused DELETE', async () => {
    stubFetch(() =>
      Promise.resolve(Response.json({ statusCode: 409, code: 'site-in-use' }, { status: 409 })),
    );

    await expect(client.delete('sites/s1')).rejects.toMatchObject({
      kind: 'http',
      status: 409,
      code: 'site-in-use',
    });
  });

  it('reads the field errors of a 400', async () => {
    const fieldErrors = { 'participation.maxDepthM': ['max'], 'observations.3.label': ['length'] };
    stubFetch(() =>
      Promise.resolve(
        Response.json({ statusCode: 400, code: 'validation-failed', fieldErrors }, { status: 400 }),
      ),
    );

    const error: unknown = await client.post('dives', {}, isNumberBody).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: 'http',
      status: 400,
      code: 'validation-failed',
      fieldErrors,
    });
  });

  it('reads the code of a 409', async () => {
    stubFetch(() =>
      Promise.resolve(
        Response.json({ statusCode: 409, code: 'identifier-conflict' }, { status: 409 }),
      ),
    );

    const error: unknown = await client.put('dives/d1', {}, isNumberBody).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'http', status: 409, code: 'identifier-conflict' });
    expect(error).toMatchObject({ fieldErrors: undefined });
  });

  it.each([
    ['a body that is not JSON', new Response('<html>Bad gateway</html>', { status: 502 })],
    ['an empty body', new Response(null, { status: 404 })],
    [
      'malformed field errors',
      Response.json({ code: 42, fieldErrors: { a: 'max' } }, { status: 400 }),
    ],
  ])('keeps the status alone for %s', async (_label, response) => {
    stubFetch(() => Promise.resolve(response));

    const error: unknown = await client.post('dives', {}, isNumberBody).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: 'http',
      status: response.status,
      code: undefined,
      fieldErrors: undefined,
    });
  });
});

describe('createApiClient — timeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects a write with a timeout ApiError once the delay is over', async () => {
    vi.useFakeTimers();
    // Never answers: only the client timeout settles the request, by aborting it.
    stubFetch(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const patient = createApiClient({ baseUrl: 'http://api.test/api', timeoutMs: 10_000 });

    const settled = patient.post('dives', {}, isNumberBody).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(9_999);
    let isPending = true;
    void settled.then(() => {
      isPending = false;
    });
    await Promise.resolve();
    expect(isPending).toBe(true);

    await vi.advanceTimersByTimeAsync(1);
    const error = await settled;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'timeout' });
  });
});

describe('createApiClient — session', () => {
  it.each(['get', 'delete'] as const)(
    'sends the session cookie with %s (same origin)',
    async (method) => {
      const fetchMock = stubFetch(() =>
        Promise.resolve(
          method === 'get' ? Response.json({ value: 1 }) : new Response(null, { status: 204 }),
        ),
      );

      await (method === 'get' ? client.get('numbers', isNumberBody) : client.delete('numbers/1'));
      expect(initOf(fetchMock).credentials).toBe('same-origin');
    },
  );

  it('sends the session cookie with a write', async () => {
    const fetchMock = stubFetch(() => Promise.resolve(Response.json({ value: 1 })));

    await client.post('numbers', {}, isNumberBody);
    expect(initOf(fetchMock).credentials).toBe('same-origin');
  });

  it.each([
    [401, 'unauthenticated'],
    [403, 'consent-required'],
    [403, 'onboarding-required'],
  ])('reads the code of a %i %s', async (status, code) => {
    stubFetch(() => Promise.resolve(Response.json({ statusCode: status, code }, { status })));

    const error: unknown = await client.get('dives', isNumberBody).catch((e: unknown) => e);
    expect(isApiHttpError(error, status, code)).toBe(true);
    expect(isApiHttpError(error, status, 'forbidden')).toBe(false);
  });

  it('reads the Retry-After of a 429', async () => {
    stubFetch(() =>
      Promise.resolve(
        Response.json(
          { statusCode: 429, code: 'too-many-attempts' },
          { status: 429, headers: { 'Retry-After': '42' } },
        ),
      ),
    );

    await expect(client.post('auth/login', {}, isNumberBody)).rejects.toMatchObject({
      status: 429,
      code: 'too-many-attempts',
      retryAfterS: 42,
    });
  });
});

describe('parseRetryAfter', () => {
  const now = Date.parse('2026-11-24T10:00:00Z');

  it.each([
    ['a delay in seconds', '120', 120],
    ['a delay with spaces', ' 5 ', 5],
    ['an HTTP date', 'Tue, 24 Nov 2026 10:01:30 GMT', 90],
    ['a past date', 'Tue, 24 Nov 2026 09:00:00 GMT', 0],
  ])('reads %s', (_label, value, expected) => {
    expect(parseRetryAfter(value, now)).toBe(expected);
  });

  it.each([
    ['a long delay', '86400', 3600],
    ['a far date', 'Wed, 24 Nov 2027 10:00:00 GMT', 3600],
  ])('caps %s at an hour', (_label, value, expected) => {
    expect(parseRetryAfter(value, now)).toBe(expected);
  });

  it.each([
    ['no header', null],
    ['garbage', 'soon'],
    ['a negative delay', '-3'],
    ['a decimal delay', '1.5'],
    ['an RFC 850 date', 'Tuesday, 24-Nov-26 10:01:30 GMT'],
    ['an asctime date', 'Tue Nov 24 10:01:30 2026'],
    ['an ISO date', '2026-11-24T10:01:30Z'],
    ['a date with a time zone', 'Tue, 24 Nov 2026 10:01:30 +0100'],
  ])('gives nothing for %s', (_label, value) => {
    expect(parseRetryAfter(value, now)).toBeUndefined();
  });
});
