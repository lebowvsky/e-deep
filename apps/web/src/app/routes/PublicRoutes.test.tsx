import { render, screen, waitFor, within } from '@testing-library/react';
import type { DataRouter } from 'react-router';
import { RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeAuthClient } from '@/shared/session/mocks/fakeAuthClient';
import { ME_FIXTURE, NEW_ACCOUNT_FIXTURE } from '@/shared/session/mocks/me';
import { PUBLIC_SESSION_PROBE_TIMEOUT_MS } from '@/shared/session/lib/redirectIfAuthenticated';
import { createTestAppRouter } from '@/test/appRouter';
import { fakeApiClient } from '@/test/fakeApiClient';
import { TestProviders } from '@/test/TestProviders';
import { renderPublicRoute, type RenderPublicRouteOptions } from '@/test/renderPublicRoute';

const renderPublic = (path: string, options: RenderPublicRouteOptions = {}) =>
  renderPublicRoute(path, options);

const locationOf = (router: DataRouter) =>
  `${router.state.location.pathname}${router.state.location.search}`;

const LANDING_TITLE = 'Toutes tes plongées, dans un seul carnet.';

describe('/ (landing page)', () => {
  it('is shown to a visitor, outside the app frame', async () => {
    renderPublic('/');

    expect(await screen.findByRole('heading', { level: 1, name: LANDING_TITLE })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).toBeNull();
    const signupLinks = screen.getAllByRole('link', { name: 'Créer mon carnet' });
    expect(signupLinks.map((link) => link.getAttribute('href'))).toContain('/signup');
    expect(screen.getByRole('link', { name: 'J’ai déjà un compte' }).getAttribute('href')).toBe(
      '/login',
    );
  });

  it('sends a signed-in diver to the dashboard', async () => {
    const router = renderPublic('/', { session: ME_FIXTURE });

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it('sends a profile still to complete to /welcome', async () => {
    const router = renderPublic('/', { session: NEW_ACCOUNT_FIXTURE });

    await waitFor(() => expect(router.state.location.pathname).toBe('/welcome'));
  });

  it('links the legal pages from its footer', async () => {
    renderPublic('/');

    const legal = await screen.findByRole('navigation', { name: 'Informations légales' });
    const hrefs = within(legal)
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/legal', '/privacy', '/terms', '/contact']);
  });
});

describe('closed beta (features.signup false)', () => {
  it('sends /signup to /login, next kept', async () => {
    const router = renderPublic('/signup?next=%2Fdives', { signup: false });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Content de te revoir' }),
    ).toBeTruthy();
    expect(locationOf(router)).toBe('/login?next=%2Fdives');
  });

  it('offers no sign-up on the landing page nor on /login', async () => {
    const router = renderPublic('/', { signup: false });

    await screen.findByRole('heading', { level: 1, name: LANDING_TITLE });
    expect(screen.queryByRole('link', { name: 'Créer mon carnet' })).toBeNull();
    expect(screen.getByText('Les inscriptions ouvrent bientôt.')).toBeTruthy();
    const loginLinks = screen.getAllByRole('link', { name: 'Se connecter' });
    expect(new Set(loginLinks.map((link) => link.getAttribute('href')))).toEqual(
      new Set(['/login']),
    );

    await router.navigate('/login');
    await screen.findByRole('heading', { level: 1, name: 'Content de te revoir' });
    expect(screen.queryByRole('link', { name: 'Créer mon carnet' })).toBeNull();
  });
});

describe('/signup with the sign-up open', () => {
  it('is shown to a visitor, and leads to /login with the same next', async () => {
    renderPublic('/signup?next=%2Fdives');

    expect(await screen.findByRole('heading', { level: 1, name: 'Ouvre ton carnet' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Se connecter' }).getAttribute('href')).toBe(
      '/login?next=%2Fdives',
    );
  });

  it('sends a signed-in diver on to next', async () => {
    const router = renderPublic('/signup?next=%2Fstats', { session: ME_FIXTURE });

    await waitFor(() => expect(router.state.location.pathname).toBe('/stats'));
  });
});

describe('public placeholder pages', () => {
  it.each([
    ['/forgot-password', 'Mot de passe oublié'],
    ['/legal', 'Mentions légales'],
    ['/privacy', 'Confidentialité'],
    ['/terms', 'Conditions d’utilisation'],
    ['/contact', 'Contact'],
  ])('shows %s to a visitor and to a signed-in diver alike', async (path, title) => {
    renderPublic(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeTruthy();
  });

  it('keeps a signed-in diver on a legal page', async () => {
    const router = renderPublic('/privacy', { session: ME_FIXTURE });

    expect(await screen.findByRole('heading', { level: 1, name: 'Confidentialité' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/privacy');
  });

  it('tells who to ask for a forgotten password during the beta', async () => {
    renderPublic('/forgot-password');

    expect(await screen.findByText(/Contacte la personne qui t’a invité à la bêta/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour à la connexion' }).getAttribute('href')).toBe(
      '/login',
    );
  });
});

describe('/logout visited', () => {
  it('signs nobody out and goes to the landing page', async () => {
    const authClient = createFakeAuthClient();
    const logout = vi.spyOn(authClient, 'logout');
    const { router, queryClient, authServices } = createTestAppRouter('/logout', { authClient });
    render(
      <TestProviders
        client={fakeApiClient({})}
        queryClient={queryClient}
        authServices={authServices}
      >
        <RouterProvider router={router} />
      </TestProviders>,
    );

    // Signed in: the landing page itself sends the diver on to the dashboard.
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(logout).not.toHaveBeenCalled();
  });
});

describe('session probe of the public pages', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the landing page when /me does not answer in time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const authClient = createFakeAuthClient({ session: null });
    // An API that never answers: only the probe's own deadline ends the wait.
    const me = vi.spyOn(authClient, 'me').mockImplementation(
      (options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    renderPublic('/', { authClient });
    expect(screen.queryByRole('heading', { level: 1, name: LANDING_TITLE })).toBeNull();

    await vi.advanceTimersByTimeAsync(PUBLIC_SESSION_PROBE_TIMEOUT_MS);

    expect(await screen.findByRole('heading', { level: 1, name: LANDING_TITLE })).toBeTruthy();
    // The request itself is cancelled, not left running.
    expect(me.mock.calls[0]?.[0]?.signal?.aborted).toBe(true);
    expect(PUBLIC_SESSION_PROBE_TIMEOUT_MS).toBeLessThan(10_000);
  });
});

describe('trailing slash', () => {
  it('opens /signup/ as the sign-up', async () => {
    renderPublic('/signup/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Ouvre ton carnet' })).toBeTruthy();
  });
});

describe('skip link of the public pages', () => {
  it('leads to a main that can take the focus', async () => {
    renderPublic('/privacy');

    await screen.findByRole('heading', { level: 1, name: 'Confidentialité' });
    expect(screen.getByRole('link', { name: 'Aller au contenu' }).getAttribute('href')).toBe(
      '#main-content',
    );
    expect(screen.getByRole('main').getAttribute('tabindex')).toBe('-1');
  });
});

describe('next on the public pages', () => {
  it('goes along with the header’s « Se connecter »', async () => {
    renderPublic('/privacy?next=%2Fstats');

    await screen.findByRole('heading', { level: 1, name: 'Confidentialité' });
    expect(screen.getByRole('link', { name: 'Se connecter' }).getAttribute('href')).toBe(
      '/login?next=%2Fstats',
    );
  });
});
