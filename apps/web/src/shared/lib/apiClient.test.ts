import { afterEach, describe, expect, it, vi } from 'vitest';
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
