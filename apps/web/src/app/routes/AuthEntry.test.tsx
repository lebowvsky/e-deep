import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { DataRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { renderPublicRoute, stubDesktop } from '@/test/renderPublicRoute';

const renderEntry = (path: string, options: { signup?: boolean } = {}) =>
  renderPublicRoute(path, options);

const locationOf = (router: DataRouter) =>
  `${router.state.location.pathname}${router.state.location.search}`;
const tab = (name: string) => screen.getByRole('tab', { name });

describe('authentication card (≥ 1024px)', () => {
  it('opens /login on the sign-in tab, the e-mail focused', async () => {
    stubDesktop();
    renderEntry('/login');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Content de te revoir' }),
    ).toBeTruthy();
    expect(tab('Se connecter').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tabpanel').getAttribute('aria-labelledby')).toBe(
      tab('Se connecter').id,
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('E-mail')));
  });

  it('opens /signup on the sign-up tab, the first name focused', async () => {
    stubDesktop();
    renderEntry('/signup');

    expect(await screen.findByRole('heading', { level: 2, name: 'Ouvre ton carnet' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Prénom')));
  });

  it('focuses nothing on the landing page', async () => {
    stubDesktop();
    renderEntry('/');

    await screen.findByRole('heading', { level: 2, name: 'Content de te revoir' });
    expect(document.activeElement).toBe(document.body);
  });

  it('moves between the tabs with the keyboard, the URL and next following', async () => {
    stubDesktop();
    const user = userEvent.setup();
    const router = renderEntry('/login?next=%2Fstats');
    await screen.findByRole('tablist');
    tab('Se connecter').focus();

    /** A key on the tabs, then the tab it selects, rendered (`/signup` has its own loader). */
    const press = async (key: string, selected: string) => {
      await user.keyboard(key);
      await waitFor(() => expect(tab(selected).getAttribute('aria-selected')).toBe('true'));
    };

    await press('{ArrowRight}', 'Créer un compte');
    expect(locationOf(router)).toBe('/signup?next=%2Fstats');
    expect(document.activeElement).toBe(tab('Créer un compte'));
    expect(screen.getByRole('heading', { level: 2, name: 'Ouvre ton carnet' })).toBeTruthy();

    // It wraps, and Home / End reach the ends.
    await press('{ArrowRight}', 'Se connecter');
    expect(router.state.location.pathname).toBe('/login');
    await press('{End}', 'Créer un compte');
    expect(router.state.location.pathname).toBe('/signup');
    await press('{Home}', 'Se connecter');
    expect(router.state.location.pathname).toBe('/login');
    await press('{ArrowLeft}', 'Créer un compte');
    expect(router.state.location.pathname).toBe('/signup');
    // A change of tab leaves the focus on the tab.
    expect(document.activeElement).toBe(tab('Créer un compte'));
  });

  it('keeps the e-mail typed from one tab to the other', async () => {
    stubDesktop();
    const user = userEvent.setup();
    renderEntry('/login');
    await user.type(await screen.findByLabelText('E-mail'), 'marine@exemple.fr');

    await user.click(tab('Créer un compte'));
    await screen.findByLabelText('Prénom');
    expect(screen.getByLabelText<HTMLInputElement>('E-mail').value).toBe('marine@exemple.fr');

    await user.click(tab('Se connecter'));
    await screen.findByRole('heading', { level: 2, name: 'Content de te revoir' });
    expect(screen.queryByLabelText('Prénom')).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>('E-mail').value).toBe('marine@exemple.fr');
  });

  it('offers no sign-up tab while the beta is closed', async () => {
    stubDesktop();
    renderEntry('/login', { signup: false });

    await screen.findByRole('heading', { level: 2, name: 'Content de te revoir' });
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByText('Inscriptions bientôt ouvertes.')).toBeTruthy();
  });
});

describe('dedicated screens (< 1024px)', () => {
  it('shows /login as its own screen, with the way to the sign-up keeping next and the e-mail', async () => {
    const user = userEvent.setup();
    const router = renderEntry('/login?next=%2Fstats');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Content de te revoir' }),
    ).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByRole('link', { name: 'Accueil' }).getAttribute('href')).toBe('/');
    // On a phone the page takes the focus, not a field: the keyboard would hide the screen.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('main')));

    await user.type(screen.getByLabelText('E-mail'), 'marine@exemple.fr');
    await user.click(screen.getByRole('link', { name: 'Créer mon carnet' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Ouvre ton carnet' })).toBeTruthy();
    expect(locationOf(router)).toBe('/signup?next=%2Fstats');
    expect(screen.getByLabelText<HTMLInputElement>('E-mail').value).toBe('marine@exemple.fr');
  });

  it('says the sign-up is not open yet under the sign-in', async () => {
    renderEntry('/login', { signup: false });

    await screen.findByRole('heading', { level: 1, name: 'Content de te revoir' });
    expect(screen.queryByRole('link', { name: 'Créer mon carnet' })).toBeNull();
    expect(screen.getByText('Inscriptions bientôt ouvertes.')).toBeTruthy();
  });
});
