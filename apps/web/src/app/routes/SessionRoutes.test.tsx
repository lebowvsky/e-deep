import type { DataRouter } from 'react-router';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  createLocalDraftStore,
  purgeAllDrafts,
  storageKeyOf,
} from '@/features/dives/form/draftStore';
import { validValues } from '@/features/dives/mocks/diveFormFixture';
import { createFakeDiveApi } from '@/features/dives/mocks/fakeDiveApi';
import { mockDiveLogResponse } from '@/features/dives/mocks/diveLogResponse';
import { DIVE_LOG_QUERY_KEY } from '@/shared/diveLog/diveLogApi';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import { sessionKeys } from '@/shared/session/api/meApi';
import type { AuthClient } from '@/shared/session/authClient';
import { createAuthBroadcast } from '@/shared/session/lib/authBroadcast';
import { createFakeAuthClient } from '@/shared/session/mocks/fakeAuthClient';
import { ME_FIXTURE } from '@/shared/session/mocks/me';
import { createHttpSitesRepository } from '@/shared/sites/api/httpSitesRepository';
import { ToastProvider } from '@/shared/ui/Toast';
import { createTestAppRouter } from '@/test/appRouter';
import { fakeApiClient } from '@/test/fakeApiClient';
import { linkedBroadcastPorts } from '@/test/linkedBroadcastPorts';
import { TestProviders } from '@/test/TestProviders';
import { createAppSession } from '../appSession';

interface RenderOptions {
  session?: typeof ME_FIXTURE | null;
  get?: ApiClient['get'];
  /** A whole fake API (the dive form reads the log and the sites); `get` is ignored then. */
  client?: ApiClient;
  /** The auth port; a fake signed in as `session` by default. */
  authClient?: AuthClient;
}

/**
 * The app's routes with the app's session wiring (`createAppSession`, as in `services.ts`), over a
 * fake auth client, a fake API and a channel to a second tab (`otherTab`).
 */
function renderApp(
  path: string,
  {
    session = ME_FIXTURE,
    get = vi.fn(),
    client,
    authClient = createFakeAuthClient({ session }),
  }: RenderOptions = {},
) {
  const [thisTab, otherTabPort] = linkedBroadcastPorts();
  // The query client is built before the router, as in `services.ts`.
  const holder: { router?: DataRouter } = {};
  const app = createAppSession({
    authClient,
    broadcast: createAuthBroadcast(() => thisTab),
    getRouter: () => {
      if (!holder.router) throw new Error('Router not created yet');
      return holder.router;
    },
  });
  const { queryClient } = app;
  const { router } = createTestAppRouter(path, { queryClient, authClient });
  holder.router = router;
  render(
    <TestProviders
      client={client ?? fakeApiClient({ get })}
      {...(client ? { sitesRepository: createHttpSitesRepository(client) } : {})}
      queryClient={queryClient}
      authServices={app.authServices}
      me={null}
    >
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </TestProviders>,
  );
  const otherTab = createAuthBroadcast(() => otherTabPort);
  return { router, queryClient, authClient, app, otherTab };
}

/** A fake API whose every read answers 401 once `expire()` is called. */
function expiringApi() {
  const api = createFakeDiveApi();
  let expired = false;
  const client: ApiClient = {
    ...api.client,
    get: (path, guard, options) =>
      expired
        ? Promise.reject(new ApiError('http', 'HTTP 401', { status: 401, code: 'unauthenticated' }))
        : api.client.get(path, guard, options),
  };
  return { client, expire: () => (expired = true) };
}

/** Records whether the error element ever shows, even for a single render. */
function watchErrorElement() {
  const shown = vi.fn();
  const observer = new MutationObserver(() => {
    if (screen.queryByRole('heading', { name: 'Une erreur est survenue' })) shown();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return { shown, stop: () => observer.disconnect() };
}

const locationOf = (router: DataRouter) =>
  `${router.state.location.pathname}${router.state.location.search}`;

describe('protected routes', () => {
  it('send a visitor without session to /login, with the page as next', async () => {
    const { router } = renderApp('/dives?region=corse', { session: null });

    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeTruthy();
    expect(locationOf(router)).toBe(`/login?next=${encodeURIComponent('/dives?region=corse')}`);
  });

  it('show the page to a signed-in diver, with their identity in the shell', async () => {
    renderApp('/dives', { get: vi.fn().mockResolvedValue(mockDiveLogResponse) });

    expect(await screen.findByRole('heading', { level: 1, name: 'Mes plongées' })).toBeTruthy();
    expect(screen.getByText(/Carnet de plongée · N2 FFESSM/)).toBeTruthy();
  });

  it.each([
    ['profile-required', '/welcome', 'Bienvenue'],
    ['consent-required', '/consent', 'Consentement'],
  ] as const)('send a %s profile to %s, which stays', async (onboarding, path, title) => {
    const { router } = renderApp('/dashboard', {
      session: { ...ME_FIXTURE, diver: { ...ME_FIXTURE.diver }, onboarding },
    });

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(router.state.location.pathname).toBe(path);
  });

  it('send a complete profile away from the onboarding pages', async () => {
    const { router } = renderApp('/welcome', { get: () => new Promise<never>(() => undefined) });

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });
});

describe('/login', () => {
  it.each([
    ['an internal next', '/login?next=%2Fstats', '/stats'],
    ['next=//evil.com', '/login?next=%2F%2Fevil.com', '/dashboard'],
    ['next=https://…', '/login?next=https%3A%2F%2Fevil.com%2Fdives', '/dashboard'],
  ])('sends a signed-in diver with %s to %s', async (_label, path, target) => {
    const { router } = renderApp(path, { get: () => new Promise<never>(() => undefined) });

    await waitFor(() => expect(router.state.location.pathname).toBe(target));
  });

  it('is shown to a visitor', async () => {
    renderApp('/login', { session: null });

    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeTruthy();
  });
});

describe('session lost while using the app', () => {
  it('clears the cache and goes to /login?next=<page> on a 401', async () => {
    const get = vi.fn((path: string) =>
      path === 'dives'
        ? Promise.reject(new ApiError('http', 'HTTP 401', { status: 401, code: 'unauthenticated' }))
        : new Promise<never>(() => undefined),
    );
    const { router, queryClient, authClient } = renderApp('/dashboard', { get });
    await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' });
    expect(queryClient.getQueryData(sessionKeys.me())).toEqual(ME_FIXTURE);

    // The session expires server-side: `/me` and the log now answer 401.
    await authClient.logout();
    await router.navigate('/dives');

    await waitFor(() => expect(locationOf(router)).toBe('/login?next=%2Fdives'));
    expect(queryClient.getQueryData(sessionKeys.me())).toBeUndefined();
    expect(queryClient.getQueryCache().find({ queryKey: ['dashboard'] })).toBeUndefined();
  });

  it('goes to /consent on a 403 consent-required, where the fresh /me keeps the diver', async () => {
    const get = vi.fn(() =>
      Promise.reject(new ApiError('http', 'HTTP 403', { status: 403, code: 'consent-required' })),
    );
    const { router, authClient } = renderApp('/dives', { get });
    // The policy changed server-side: the API now answers `consent-required`.
    vi.spyOn(authClient, 'me').mockResolvedValue({ ...ME_FIXTURE, onboarding: 'consent-required' });

    expect(await screen.findByRole('heading', { level: 1, name: 'Consentement' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/consent');
  });
});

describe('session lost while a page holding the diver is mounted', () => {
  it('ends on /login?next=… without any error surfacing nor a second /me', async () => {
    const consoleError = vi.spyOn(console, 'error');
    const api = expiringApi();
    const { router, queryClient, authClient } = renderApp('/dives/new', { client: api.client });
    // The form itself, not only its loading top bar.
    expect(await screen.findByLabelText('Notes')).toBeTruthy();
    const me = vi.spyOn(authClient, 'me');
    const errorElement = watchErrorElement();

    // The session expires server-side, then the mounted form reads the log again.
    api.expire();
    await authClient.logout();
    await queryClient.invalidateQueries({ queryKey: DIVE_LOG_QUERY_KEY });

    await waitFor(() => expect(locationOf(router)).toBe('/login?next=%2Fdives%2Fnew'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeTruthy();
    errorElement.stop();
    expect(errorElement.shown).not.toHaveBeenCalled();
    // Only the login page's own check: the mounted form never asked for `/me` again.
    expect(me).toHaveBeenCalledTimes(1);
    const logged = consoleError.mock.calls.flat().map(String).join('\n');
    expect(logged).not.toMatch(/AuthError|unauthenticated|concurrent rendering/);
  });

  it('navigates once when several calls fail together', async () => {
    const { router, app, authClient, queryClient } = renderApp('/dashboard', {
      get: () => new Promise<never>(() => undefined),
    });
    await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' });
    await authClient.logout();
    const navigate = vi.spyOn(router, 'navigate');

    // As the policy does on each 401: the cache first, then the navigation.
    act(() => {
      queryClient.clear();
      app.navigation.onUnauthenticated();
      app.navigation.onUnauthenticated();
    });

    expect(navigate).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/login?next=%2Fdashboard', { replace: true });
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });
});

describe('logout in another tab', () => {
  it('clears this tab, which leaves the form for /login without error nor draft', async () => {
    const consoleError = vi.spyOn(console, 'error');
    const api = expiringApi();
    const { router, queryClient, authClient, otherTab } = renderApp('/dives/new', {
      client: api.client,
    });
    // A change still waiting for its draft delay when the other tab signs out.
    await userEvent.type(await screen.findByLabelText('Notes'), 'Mérou');
    const errorElement = watchErrorElement();

    // The other tab signs out: server session closed, drafts purged, then the message.
    api.expire();
    await authClient.logout();
    purgeAllDrafts();
    act(() => otherTab.announceLogout());

    await waitFor(() => expect(locationOf(router)).toBe('/login?next=%2Fdives%2Fnew'));
    errorElement.stop();
    expect(errorElement.shown).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(sessionKeys.me())).toBeUndefined();
    // The form unmounted with its pending change: nothing written back.
    expect(localStorage.getItem(storageKeyOf(ME_FIXTURE.diver.id, 'new'))).toBeNull();
    const logged = consoleError.mock.calls.flat().map(String).join('\n');
    expect(logged).not.toMatch(/AuthError|unauthenticated|concurrent rendering/);
  });
});

describe('logout wiring of the app', () => {
  it('erases the dive drafts of the device and tells the other tabs', async () => {
    localStorage.clear();
    const { app, otherTab } = renderApp('/login', {
      session: ME_FIXTURE,
      get: () => new Promise<never>(() => undefined),
    });
    const draft = {
      values: validValues(),
      ids: { eventId: 'e1', newSiteId: 's1' },
      savedAt: Date.now(),
    };
    await createLocalDraftStore(ME_FIXTURE.diver.id).save('new', draft);
    const told = vi.fn();
    otherTab.onLogout(told);

    const { result } = renderHook(() => useAuth(), {
      wrapper: ({ children }) => (
        <TestProviders
          client={fakeApiClient({})}
          queryClient={app.queryClient}
          authServices={app.authServices}
        >
          {children}
        </TestProviders>
      ),
    });
    await act(() => result.current.logout());

    expect(localStorage.getItem(storageKeyOf(ME_FIXTURE.diver.id, 'new'))).toBeNull();
    expect(told).toHaveBeenCalledOnce();
  });
});

describe('error element of the session routes', () => {
  it('offers to try again, which runs the loader anew', async () => {
    const user = userEvent.setup();
    let isDown = true;
    const fake = createFakeAuthClient();
    const authClient: AuthClient = {
      ...fake,
      me: (options) =>
        isDown
          ? Promise.reject(new ApiError('network', 'The API is unreachable.'))
          : fake.me(options),
    };
    renderApp('/stats', { authClient });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Une erreur est survenue' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Retour au tableau de bord' }).getAttribute('href'),
    ).toBe('/dashboard');

    isDown = false;
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Statistiques' })).toBeTruthy();
  });
});
