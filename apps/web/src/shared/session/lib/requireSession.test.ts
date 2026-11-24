import type { MeResponse } from '@e-deep/shared';
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/lib/apiClient';
import { sessionKeys } from '../api/meApi';
import type { AuthClient } from '../authClient';
import { createFakeAuthClient } from '../mocks/fakeAuthClient';
import { ME_FIXTURE, NEW_ACCOUNT_FIXTURE } from '../mocks/me';
import { redirectIfAuthenticated } from './redirectIfAuthenticated';
import { requireOnboardingStep, requireSession } from './requireSession';

const ORIGIN = 'http://app.test';
const request = (path: string) => ({ request: new Request(`${ORIGIN}${path}`) });

function setup(authClient: AuthClient = createFakeAuthClient()) {
  return { queryClient: new QueryClient(), authClient };
}

const signedIn = (me: MeResponse) => setup(createFakeAuthClient({ session: me }));
const signedOut = () => setup(createFakeAuthClient({ session: null }));
const failing = () =>
  setup({
    ...createFakeAuthClient(),
    me: () => Promise.reject(new ApiError('network', 'The API is unreachable.')),
  });

/** Where a loader result redirects, `null` when it lets the page render. */
function redirectedTo(result: Response | null): string | null {
  return result === null ? null : result.headers.get('Location');
}

describe('requireSession', () => {
  it('lets a complete profile in, and caches /me', async () => {
    const dependencies = signedIn(ME_FIXTURE);

    expect(redirectedTo(await requireSession(dependencies)(request('/dives')))).toBeNull();
    expect(dependencies.queryClient.getQueryData(sessionKeys.me())).toEqual(ME_FIXTURE);
  });

  it('sends a visitor without session to /login, with the path, query and hash as next', async () => {
    const result = await requireSession(signedOut())(request('/dives/d127?from=log#notes'));

    expect(redirectedTo(result)).toBe(
      `/login?next=${encodeURIComponent('/dives/d127?from=log#notes')}`,
    );
  });

  it('drops what the cache held when there is no session any more', async () => {
    const dependencies = signedOut();
    dependencies.queryClient.setQueryData(['dives', 'log'], { dives: ['of the last session'] });

    await requireSession(dependencies)(request('/dives'));

    expect(dependencies.queryClient.getQueryData(['dives', 'log'])).toBeUndefined();
  });

  it.each([
    ['profile-required', '/welcome'],
    ['consent-required', '/consent'],
  ] as const)('sends a %s profile to %s', async (onboarding, path) => {
    const result = await requireSession(signedIn({ ...NEW_ACCOUNT_FIXTURE, onboarding }))(
      request('/dashboard'),
    );

    expect(redirectedTo(result)).toBe(path);
  });

  it('reuses the cached /me without calling the API again', async () => {
    let calls = 0;
    const fake = createFakeAuthClient();
    const dependencies = setup({
      ...fake,
      me: (options) => {
        calls += 1;
        return fake.me(options);
      },
    });

    await requireSession(dependencies)(request('/dives'));
    await requireSession(dependencies)(request('/map'));

    expect(calls).toBe(1);
  });

  it('reads /me again once it was invalidated (a 403 met on the way)', async () => {
    const dependencies = signedIn({ ...ME_FIXTURE, onboarding: 'consent-required' });
    dependencies.queryClient.setQueryData(sessionKeys.me(), ME_FIXTURE);
    await dependencies.queryClient.invalidateQueries({
      queryKey: sessionKeys.all,
      refetchType: 'none',
    });

    expect(redirectedTo(await requireSession(dependencies)(request('/dives')))).toBe('/consent');
  });

  it('fails, without redirecting, when the session cannot be checked', async () => {
    await expect(requireSession(failing())(request('/dives'))).rejects.toMatchObject({
      kind: 'network',
    });
  });
});

describe('requireOnboardingStep', () => {
  it.each([
    ['/welcome', 'profile-required', 'profile-required', null],
    ['/welcome', 'profile-required', 'consent-required', '/consent'],
    ['/welcome', 'profile-required', 'complete', '/dashboard'],
    ['/consent', 'consent-required', 'consent-required', null],
    ['/consent', 'consent-required', 'profile-required', '/welcome'],
    ['/consent', 'consent-required', 'complete', '/dashboard'],
  ] as const)(
    '%s, for a %s step, with a %s profile → %s',
    async (path, step, onboarding, target) => {
      const loader = requireOnboardingStep(signedIn({ ...ME_FIXTURE, onboarding }), step);

      expect(redirectedTo(await loader(request(path)))).toBe(target);
    },
  );

  it('sends a visitor without session to /login', async () => {
    const result = await requireOnboardingStep(
      signedOut(),
      'profile-required',
    )(request('/welcome'));

    expect(redirectedTo(result)).toBe('/login?next=%2Fwelcome');
  });
});

describe('redirectIfAuthenticated', () => {
  it('shows the page to a visitor without session', async () => {
    expect(redirectedTo(await redirectIfAuthenticated(signedOut())(request('/login')))).toBeNull();
  });

  it('shows the page when the session cannot be checked', async () => {
    expect(redirectedTo(await redirectIfAuthenticated(failing())(request('/login')))).toBeNull();
  });

  it.each([
    ['no next', '/login', '/dashboard'],
    ['an internal next', '/login?next=%2Fdives%2Fd127%3Ffrom%3Dlog', '/dives/d127?from=log'],
    ['a protocol-relative next', '/login?next=%2F%2Fevil.com', '/dashboard'],
    ['an absolute next', '/login?next=https%3A%2F%2Fevil.com%2Fdashboard', '/dashboard'],
  ])('sends a signed-in diver with %s to %s', async (_label, path, target) => {
    const result = await redirectIfAuthenticated(signedIn(ME_FIXTURE))(request(path));

    expect(redirectedTo(result)).toBe(target);
  });

  it('sends a diver still in onboarding to their step, not to next', async () => {
    const result = await redirectIfAuthenticated(signedIn(NEW_ACCOUNT_FIXTURE))(
      request('/login?next=%2Fdives'),
    );

    expect(redirectedTo(result)).toBe('/welcome');
  });
});
