import type { MeResponse } from '@e-deep/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DataRouter } from 'react-router';
import { RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appConfig } from '@/shared/config/app';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import { sessionKeys } from '@/shared/session/api/meApi';
import { createAuthBroadcast } from '@/shared/session/lib/authBroadcast';
import { createFakeAuthClient, FAKE_CREDENTIALS } from '@/shared/session/mocks/fakeAuthClient';
import { ME_FIXTURE } from '@/shared/session/mocks/me';
import { ToastProvider } from '@/shared/ui/Toast';
import { createTestAppRouter } from '@/test/appRouter';
import { fakeApiClient } from '@/test/fakeApiClient';
import { linkedBroadcastPorts } from '@/test/linkedBroadcastPorts';
import { TestProviders } from '@/test/TestProviders';
import { createAppSession } from '../appSession';

type FakeAuthClient = ReturnType<typeof createFakeAuthClient>;

const LANDING_TITLE = 'Toutes tes plongées, dans un seul carnet.';
const NEW_DIVER = { firstName: 'Ana', email: 'ana@example.test', password: 'palmes-et-tuba-2026' };

/**
 * The carnet's reads: they hang while the profile is complete, and answer as the API would
 * otherwise (`401` without a session, `403` before the onboarding is done).
 */
function carnetApi(authClient: FakeAuthClient): ApiClient['get'] {
  return vi.fn(() => {
    const { session } = authClient;
    if (session === null) {
      return Promise.reject(
        new ApiError('http', 'HTTP 401', { status: 401, code: 'unauthenticated' }),
      );
    }
    if (session.onboarding === 'profile-required') {
      return Promise.reject(
        new ApiError('http', 'HTTP 403', { status: 403, code: 'onboarding-required' }),
      );
    }
    return new Promise<never>(() => undefined);
  });
}

/** The app's routes with the app's session wiring (`createAppSession`), over a fake auth client. */
function renderApp(path: string, authClient: FakeAuthClient, get = carnetApi(authClient)) {
  const [thisTab, otherTabPort] = linkedBroadcastPorts();
  const holder: { router?: DataRouter } = {};
  const app = createAppSession({
    authClient,
    broadcast: createAuthBroadcast(() => thisTab),
    getRouter: () => {
      if (!holder.router) throw new Error('Router not created yet');
      return holder.router;
    },
  });
  const { router } = createTestAppRouter(path, {
    queryClient: app.queryClient,
    authServices: app.authServices,
  });
  holder.router = router;
  render(
    <TestProviders
      client={fakeApiClient({ get })}
      queryClient={app.queryClient}
      authServices={app.authServices}
      config={{ ...appConfig, features: { ...appConfig.features, signup: true } }}
      me={null}
    >
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </TestProviders>,
  );
  const otherTab = createAuthBroadcast(() => otherTabPort);
  return { router, queryClient: app.queryClient, otherTab };
}

// jsdom does not scroll: the landing notice takes the page back to its top.
const scrollTo = vi.fn();
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(scrollTo);
});

afterEach(() => {
  vi.restoreAllMocks();
  scrollTo.mockClear();
});

const heading = (name: string) => screen.findByRole('heading', { level: 1, name });

describe('first launch', () => {
  it('goes from the sign-up to /welcome, keeps the diver there, then opens the page asked for and signs out', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: null });
    const { router } = renderApp('/signup', authClient);

    await user.type(await screen.findByLabelText('Prénom'), NEW_DIVER.firstName);
    await user.type(screen.getByLabelText('E-mail'), NEW_DIVER.email);
    await user.type(screen.getByLabelText('Mot de passe'), NEW_DIVER.password);
    await user.click(screen.getByRole('button', { name: 'Créer mon carnet' }));
    expect(await heading('Bienvenue, Ana')).toBeTruthy();

    // A page of the carnet before the end of the first launch: back to /welcome, then to it.
    await router.navigate('/dives?sort=date');
    await waitFor(() => expect(router.state.location.pathname).toBe('/welcome'));
    expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/dives?sort=date')}`);
    expect(await heading('Bienvenue, Ana')).toBeTruthy();

    await screen.findByRole('option', { name: 'Niveau 1 · FFESSM' });
    await user.selectOptions(screen.getByLabelText(/Niveau de plongée/), 'Niveau 1 · FFESSM');
    await user.click(screen.getByRole('checkbox', { name: /J’accepte que/ }));
    await user.click(screen.getByRole('button', { name: 'Ouvrir mon carnet' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/dives'));
    expect(router.state.location.search).toBe('?sort=date');
    expect(authClient.session).toMatchObject({ onboarding: 'complete' });

    await user.click(await screen.findByRole('button', { name: 'Ouvrir le menu' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Menu' })).getByRole('button', {
        name: 'Déconnexion',
      }),
    );
    expect(await heading(LANDING_TITLE)).toBeTruthy();
    expect(authClient.session).toBeNull();
  });

  it('lets the diver sign out from /welcome', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({
      session: {
        ...ME_FIXTURE,
        diver: { ...ME_FIXTURE.diver, level: null },
        consent: null,
        onboarding: 'profile-required',
      },
    });
    const { router } = renderApp('/welcome', authClient);

    expect(await heading('Bienvenue, Marine')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Accueil' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Se déconnecter' }));

    expect(await heading(LANDING_TITLE)).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
    expect(authClient.session).toBeNull();
  });
});

describe('re-consent', () => {
  it('is asked after a 403 consent-required, then leads back to the page refused', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient();
    // The policy changed server-side: the API answers `consent-required` until it is renewed.
    const consentRequired: MeResponse = { ...ME_FIXTURE, onboarding: 'consent-required' };
    const me = vi.spyOn(authClient, 'me').mockResolvedValue(consentRequired);
    const get = vi.fn((): Promise<never> =>
      Promise.reject(new ApiError('http', 'HTTP 403', { status: 403, code: 'consent-required' })),
    );
    const { router, queryClient } = renderApp('/dives', authClient, get);

    expect(await heading('Notre politique a changé')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/consent');
    expect(router.state.location.search).toBe('?next=%2Fdives');

    me.mockRestore();
    get.mockImplementation(() => new Promise<never>(() => undefined));
    await user.click(screen.getByRole('checkbox', { name: /J’accepte que/ }));
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/dives'));
    expect(queryClient.getQueryData(sessionKeys.me())).toMatchObject({ onboarding: 'complete' });
  });

  it('refused: deleting the account leads to the landing page, which says so', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({
      session: { ...ME_FIXTURE, onboarding: 'consent-required' },
    });
    const { router } = renderApp('/consent', authClient);

    expect(await heading('Notre politique a changé')).toBeTruthy();
    expect(
      screen.getByText(
        'Tu ne veux pas donner ton accord ? Sans lui, ton carnet ne peut pas être conservé.',
      ),
    ).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Supprimer ton compte ?' });
    await user.type(within(dialog).getByLabelText('Mot de passe'), FAKE_CREDENTIALS.password);
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer définitivement' }));

    expect(await heading(LANDING_TITLE)).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
    expect(
      screen
        .getByText('Ton compte et ton carnet ont été supprimés.')
        .closest('[role]')
        ?.getAttribute('role'),
    ).toBe('status');
    expect(authClient.session).toBeNull();
  });
});

describe('/settings', () => {
  it('shows the account, read only, and the consent given', async () => {
    renderApp('/settings', createFakeAuthClient());

    expect(await heading('Paramètres')).toBeTruthy();
    const account = screen.getByRole('region', { name: 'Compte' });
    expect(within(account).getByText('Marine Rousseau')).toBeTruthy();
    expect(within(account).getByText(ME_FIXTURE.account.email)).toBeTruthy();
    expect(within(account).getByText('Niveau 2 · FFESSM')).toBeTruthy();
    expect(within(account).queryByRole('button')).toBeNull();
    expect(within(account).queryByRole('link')).toBeNull();
    expect(screen.getByText(/Tu as donné ton accord le/).textContent).toBe(
      'Tu as donné ton accord le 20 novembre 2026 (version 2026-11).',
    );
  });

  it('changes the password and stays signed in', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient();
    const { router } = renderApp('/settings', authClient);
    await heading('Paramètres');

    await user.type(screen.getByLabelText('Mot de passe actuel'), FAKE_CREDENTIALS.password);
    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'nouvelles-bulles-2027');
    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));

    expect(
      await screen.findByText('Mot de passe modifié. Tes autres appareils ont été déconnectés.'),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe('/settings');
    expect(authClient.session).not.toBeNull();
  });

  it('signs out every device after a confirmation, then clears this tab and the others', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient();
    const logoutAll = vi.spyOn(authClient, 'logoutAll');
    const { router, queryClient, otherTab } = renderApp('/settings', authClient);
    const told = vi.fn();
    otherTab.onLogout(told);
    await heading('Paramètres');

    await user.click(screen.getByRole('button', { name: 'Déconnecter tous les appareils' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Déconnecter tous les appareils ?' });
    expect(logoutAll).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Tout déconnecter' }));

    expect(await heading(LANDING_TITLE)).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
    expect(logoutAll).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(sessionKeys.me())).toBeUndefined();
    expect(told).toHaveBeenCalledOnce();
  });

  it('keeps everything and says so when the devices cannot be signed out', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient();
    vi.spyOn(authClient, 'logoutAll').mockRejectedValue(
      new ApiError('network', 'The API is unreachable.'),
    );
    const { router, queryClient } = renderApp('/settings', authClient);
    await heading('Paramètres');

    await user.click(screen.getByRole('button', { name: 'Déconnecter tous les appareils' }));
    await user.click(screen.getByRole('button', { name: 'Tout déconnecter' }));

    expect(
      await screen.findByText(
        'La déconnexion des appareils n’a pas abouti. Vérifie ton réseau et réessaie.',
      ),
    ).toBeTruthy();
    expect(router.state.location.pathname).toBe('/settings');
    expect(queryClient.getQueryData(sessionKeys.me())).toEqual(ME_FIXTURE);
  });

  it('deletes the account: a wrong password keeps the dialog, the right one leads to the landing page', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient();
    const { router, otherTab } = renderApp('/settings', authClient);
    const told = vi.fn();
    otherTab.onLogout(told);
    await heading('Paramètres');

    await user.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Supprimer ton compte ?' });
    const password = within(dialog).getByLabelText('Mot de passe');
    await user.type(password, 'pas-le-bon-mot-de-passe{Enter}');
    expect(await within(dialog).findByText('Mot de passe incorrect.')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/settings');

    await user.type(password, `${FAKE_CREDENTIALS.password}{Enter}`);

    expect(await heading(LANDING_TITLE)).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
    const notice = screen.getByText('Ton compte et ton carnet ont été supprimés.');
    // Read first, the page from its top: the page left was scrolled down to the deletion.
    expect(document.activeElement).toBe(notice.closest('[role="status"]'));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(authClient.session).toBeNull();
    expect(told).toHaveBeenCalledOnce();

    // Said once: the history entry no longer holds it (a reload, a return to it)…
    await waitFor(() => expect(router.state.location.state).toBeNull());
    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByText('Ton compte et ton carnet ont été supprimés.')).toBeTruthy();
    // …and leaving the landing page dismisses it.
    await router.navigate('/login');
    await waitFor(() =>
      expect(screen.queryByText('Ton compte et ton carnet ont été supprimés.')).toBeNull(),
    );
    await router.navigate('/');
    expect(await heading(LANDING_TITLE)).toBeTruthy();
    expect(screen.queryByText('Ton compte et ton carnet ont été supprimés.')).toBeNull();
  });

  it('takes a deletion whose session is already over to the login page, the cache cleared', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient();
    const { router, queryClient } = renderApp('/settings', authClient);
    await heading('Paramètres');
    // The session ends elsewhere (expired, signed out from another device) while the page is open.
    await authClient.logout();

    await user.click(screen.getByRole('button', { name: 'Supprimer mon compte' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Supprimer ton compte ?' });
    await user.type(
      within(dialog).getByLabelText('Mot de passe'),
      `${FAKE_CREDENTIALS.password}{Enter}`,
    );

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(router.state.location.search).toBe('?next=%2Fsettings');
    expect(queryClient.getQueryData(sessionKeys.me())).toBeUndefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
