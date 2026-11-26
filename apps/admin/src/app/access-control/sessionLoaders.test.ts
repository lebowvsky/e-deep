import { describe, expect, it } from 'vitest';
import { adminMe, createFakeApiClient, httpError, networkError } from '@/test/fakeApiClient';
import { redirectIfSignedIn, requireStaffSession, type StaffRoute } from './sessionLoaders';

const ROUTES: StaffRoute[] = [
  { index: true, handle: { allowedRoles: ['support', 'admin'] } },
  { path: '/accounts', handle: { allowedRoles: ['admin'] } },
];

const request = (path: string) => new Request(`http://admin.test${path}`);

/** The `Location` of a redirect, or `null` when the loader did not redirect. */
function locationOf(result: unknown): string | null {
  return result instanceof Response ? result.headers.get('Location') : null;
}

describe('requireStaffSession', () => {
  it('returns the session of a staff member allowed on the page', async () => {
    const { apiClient, ...api } = createFakeApiClient();
    api.get.mockResolvedValue(adminMe('support'));

    await expect(
      requireStaffSession({ apiClient }, ROUTES)({ request: request('/') }),
    ).resolves.toEqual({ email: 'support@e-deep.test', role: 'support' });
    expect(api.get.mock.calls[0]?.[0]).toBe('/admin/me');
  });

  it('sends a 401 to the login page, back to the page once signed in', async () => {
    const { apiClient, ...api } = createFakeApiClient();
    api.get.mockRejectedValue(httpError(401, 'unauthenticated'));

    const result = await requireStaffSession(
      { apiClient },
      ROUTES,
    )({
      request: request('/accounts?tab=1'),
    });
    expect(locationOf(result)).toBe('/login?next=%2Faccounts%3Ftab%3D1');
  });

  it('sends a 403 to the forbidden page', async () => {
    const { apiClient, ...api } = createFakeApiClient();
    api.get.mockRejectedValue(httpError(403));

    const result = await requireStaffSession({ apiClient }, ROUTES)({ request: request('/') });
    expect(locationOf(result)).toBe('/forbidden');
  });

  it('sends a role the page does not allow to the forbidden page', async () => {
    const { apiClient, ...api } = createFakeApiClient();
    api.get.mockResolvedValue(adminMe('support'));

    const result = await requireStaffSession(
      { apiClient },
      ROUTES,
    )({
      request: request('/accounts'),
    });
    expect(locationOf(result)).toBe('/forbidden');
  });

  it('refuses a path no route declares', async () => {
    const { apiClient, ...api } = createFakeApiClient();
    api.get.mockResolvedValue(adminMe('admin'));

    const result = await requireStaffSession({ apiClient }, ROUTES)({ request: request('/nope') });
    expect(locationOf(result)).toBe('/forbidden');
  });

  it('rejects any other failure, for the error element', async () => {
    const { apiClient, ...api } = createFakeApiClient();
    api.get.mockRejectedValue(networkError());

    await expect(
      requireStaffSession({ apiClient }, ROUTES)({ request: request('/') }),
    ).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('redirectIfSignedIn', () => {
  it('sends a signed-in staff member on to next', async () => {
    const { apiClient, ...api } = createFakeApiClient();
    api.get.mockResolvedValue(adminMe());

    const result = await redirectIfSignedIn({ apiClient })({
      request: request('/login?next=%2Faccounts'),
    });
    expect(locationOf(result)).toBe('/accounts');
  });

  it('refuses an external next', async () => {
    const { apiClient, ...api } = createFakeApiClient();
    api.get.mockResolvedValue(adminMe());

    const result = await redirectIfSignedIn({ apiClient })({
      request: request('/login?next=%2F%2Fevil.com'),
    });
    expect(locationOf(result)).toBe('/');
  });

  it.each([
    ['without a session', httpError(401)],
    ['when the API is unreachable', networkError()],
  ])('shows the form %s', async (_label, error) => {
    const { apiClient, ...api } = createFakeApiClient();
    api.get.mockRejectedValue(error);

    await expect(
      redirectIfSignedIn({ apiClient })({ request: request('/login') }),
    ).resolves.toBeNull();
  });
});
