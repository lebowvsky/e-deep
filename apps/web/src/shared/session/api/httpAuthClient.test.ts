import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from '@/shared/lib/apiClient';
import { AuthError, isAuthFailure } from '../authClient';
import { ME_FIXTURE } from '../mocks/me';
import { createHttpAuthClient } from './httpAuthClient';

const authClient = createHttpAuthClient(createApiClient({ baseUrl: 'http://app.test/api' }));

function stubFetch(response: () => Response) {
  const fetchMock = vi.fn<typeof fetch>(() => Promise.resolve(response()));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const refusal = (status: number, code?: string, headers?: Record<string, string>) => () =>
  Response.json(
    { statusCode: status, ...(code ? { code } : {}) },
    { status, ...(headers ? { headers } : {}) },
  );

const login = () =>
  authClient.login({ email: 'a@b.c', password: 'x'.repeat(15), rememberMe: true });

describe('httpAuthClient — calls', () => {
  it('reads /me with the session cookie', async () => {
    const fetchMock = stubFetch(() => Response.json(ME_FIXTURE));

    await expect(authClient.me()).resolves.toEqual(ME_FIXTURE);
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL('http://app.test/api/me'));
    expect(fetchMock.mock.calls[0]?.[1]?.credentials).toBe('same-origin');
  });

  it.each([
    ['login', () => login(), 'auth/login'],
    [
      'signup',
      () => authClient.signup({ firstName: 'Ana', email: 'a@b.c', password: 'p' }),
      'auth/register',
    ],
    [
      'completeOnboarding',
      () =>
        authClient.completeOnboarding({
          lastName: null,
          certificationLevelId: 'l1',
          healthDataConsent: true,
          policyVersion: '2026-11',
        }),
      'me/onboarding',
    ],
    [
      'grantConsent',
      () =>
        authClient.grantConsent({ purpose: 'health_data_processing', policyVersion: '2026-11' }),
      'me/consents',
    ],
  ])('%s posts to /api/%s and answers the new /me', async (_label, call, path) => {
    const fetchMock = stubFetch(() => Response.json(ME_FIXTURE));

    await expect(call()).resolves.toEqual(ME_FIXTURE);
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL(`http://app.test/api/${path}`));
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST');
  });

  it('logs out on an empty 204', async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }));

    await expect(authClient.logout()).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0]?.[0]).toEqual(new URL('http://app.test/api/auth/logout'));
  });

  it('refuses a /me of the wrong shape', async () => {
    stubFetch(() => Response.json({ ...ME_FIXTURE, onboarding: 'maybe' }));

    await expect(authClient.me()).rejects.toMatchObject({ kind: 'invalid-response' });
  });
});

describe('httpAuthClient — typed errors', () => {
  it.each([
    [
      '401 invalid-credentials',
      refusal(401, 'invalid-credentials'),
      { code: 'invalid-credentials' },
    ],
    ['401 unauthenticated', refusal(401, 'unauthenticated'), { code: 'unauthenticated' }],
    ['a 401 without code', () => new Response(null, { status: 401 }), { code: 'unauthenticated' }],
    [
      '403 registration-closed',
      refusal(403, 'registration-closed'),
      { code: 'registration-closed' },
    ],
    ['409 email-taken', refusal(409, 'email-taken'), { code: 'email-taken' }],
    [
      '409 onboarding-complete',
      refusal(409, 'onboarding-complete'),
      { code: 'onboarding-complete' },
    ],
    [
      '429 with Retry-After',
      refusal(429, 'too-many-attempts', { 'Retry-After': '30' }),
      { code: 'too-many-attempts', retryAfterS: 30 },
    ],
    [
      '429 without Retry-After',
      refusal(429, 'too-many-attempts'),
      { code: 'too-many-attempts', retryAfterS: null },
    ],
    [
      '400 validation-failed',
      () =>
        Response.json(
          {
            statusCode: 400,
            code: 'validation-failed',
            fieldErrors: { password: ['compromised'] },
          },
          { status: 400 },
        ),
      { code: 'validation-failed', fieldErrors: { password: ['compromised'] } },
    ],
  ])('maps %s', async (_label, response, failure) => {
    stubFetch(response);

    const error: unknown = await login().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect(error).toMatchObject({ failure });
    // The HTTP error stays reachable for diagnosis, never shown.
    expect((error as Error).cause).toBeInstanceOf(ApiError);
  });

  it('narrows a failure by its code', async () => {
    stubFetch(refusal(429, 'too-many-attempts', { 'Retry-After': '12' }));

    const error: unknown = await login().catch((e: unknown) => e);
    expect(isAuthFailure(error, 'too-many-attempts') && error.failure.retryAfterS).toBe(12);
    expect(isAuthFailure(error, 'invalid-credentials')).toBe(false);
  });

  it.each([
    ['a 500', () => new Response(null, { status: 500 })],
    ['a 403 forbidden', refusal(403, 'forbidden')],
    ['a 409 of another code', refusal(409, 'identifier-conflict')],
  ])('leaves %s as an ApiError', async (_label, response) => {
    stubFetch(response);

    const error: unknown = await authClient.me().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
  });

  it('leaves a network failure as an ApiError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(() => Promise.reject(new TypeError('offline'))),
    );

    await expect(authClient.me()).rejects.toMatchObject({ kind: 'network' });
  });
});
