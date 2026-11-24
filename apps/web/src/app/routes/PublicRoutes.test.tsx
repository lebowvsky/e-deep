import type { MeResponse } from '@e-deep/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { DataRouter } from 'react-router';
import { RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { appConfig, type AppConfig } from '@/shared/config/app';
import { createFakeAuthClient } from '@/shared/session/mocks/fakeAuthClient';
import { ME_FIXTURE, NEW_ACCOUNT_FIXTURE } from '@/shared/session/mocks/me';
import { ToastProvider } from '@/shared/ui/Toast';
import { createTestAppRouter } from '@/test/appRouter';
import { fakeApiClient } from '@/test/fakeApiClient';
import { TestProviders } from '@/test/TestProviders';

interface RenderOptions {
  /** No session by default: these are the visitor's pages. */
  session?: MeResponse | null;
  signup?: boolean;
}

function renderPublic(path: string, { session = null, signup = true }: RenderOptions = {}) {
  const features = { ...appConfig.features, signup };
  const config: AppConfig = { ...appConfig, features };
  const { router, queryClient, authServices } = createTestAppRouter(path, {
    authClient: createFakeAuthClient({ session }),
    features,
  });
  render(
    <TestProviders
      client={fakeApiClient({ get: vi.fn(() => new Promise<never>(() => undefined)) })}
      queryClient={queryClient}
      authServices={authServices}
      config={config}
      me={null}
    >
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </TestProviders>,
  );
  return router;
}

const locationOf = (router: DataRouter) =>
  `${router.state.location.pathname}${router.state.location.search}`;

const LANDING_TITLE = 'Toutes tes plongées, dans un seul carnet.';

describe('/ (landing page)', () => {
  it('is shown to a visitor, outside the app frame', async () => {
    renderPublic('/');

    expect(await screen.findByRole('heading', { level: 1, name: LANDING_TITLE })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Créer mon carnet' }).getAttribute('href')).toBe(
      '/signup',
    );
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
    expect(screen.getByText(/Inscriptions bientôt ouvertes/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Se connecter' }).getAttribute('href')).toBe('/login');

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
