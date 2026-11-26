import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_NAME } from '@/shared/config/app';
import { renderPublicRoute, stubDesktop } from '@/test/renderPublicRoute';

const PRIVACY = 'Ton carnet et tes sites ne sont visibles que par toi.';

const anchorsNav = () => screen.getByRole('navigation', { name: 'Sur cette page' });
const featureTitles = () =>
  within(screen.getByRole('region', { name: 'Pensé par et pour des plongeurs' }))
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent);
const finalCta = () =>
  screen.getByRole('region', { name: 'Ta prochaine plongée mérite mieux qu’un post-it.' });

const scrollIntoView = vi.fn();

beforeEach(() => {
  // jsdom lays nothing out: no scrolling to measure, only the call.
  Element.prototype.scrollIntoView = scrollIntoView;
});

afterEach(() => {
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  scrollIntoView.mockClear();
});

describe('landing page (≥ 1024px)', () => {
  it('has one h1, its own title, and the authentication card', async () => {
    stubDesktop();
    renderPublicRoute('/');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Content de te revoir' }),
    ).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(document.title).toBe(`${APP_NAME} — Ton carnet de plongée numérique`);
  });

  it('anchors the sections it has', async () => {
    stubDesktop();
    renderPublicRoute('/', { privacyCopy: PRIVACY });
    await screen.findByRole('heading', { level: 1 });

    const hrefs = within(anchorsNav())
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['#comment-ca-marche', '#fonctionnalites', '#confidentialite']);
    for (const href of hrefs) expect(document.getElementById(href?.slice(1) ?? '')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Découvre l’app plus bas/ }).getAttribute('href')).toBe(
      '#apercu',
    );
    expect(document.getElementById('apercu')).not.toBeNull();
  });

  it('shows the product as sized, lazy images named with the product', async () => {
    stubDesktop();
    renderPublicRoute('/');
    await screen.findByRole('heading', { level: 1 });

    const images = within(screen.getByRole('region', { name: 'Aperçu de l’app' })).getAllByRole(
      'img',
    );
    expect(images).toHaveLength(2);
    for (const image of images) {
      expect(image.getAttribute('alt')).toContain(APP_NAME);
      expect(image.getAttribute('loading')).toBe('lazy');
      expect(Number(image.getAttribute('width'))).toBeGreaterThan(0);
      expect(Number(image.getAttribute('height'))).toBeGreaterThan(0);
    }
  });
});

describe('promises of the landing page (D45)', () => {
  it('promises nothing offline while the app does not work without network', async () => {
    stubDesktop();
    renderPublicRoute('/', { offline: false, privacyCopy: PRIVACY });
    await screen.findByRole('heading', { level: 1 });

    expect(screen.queryByText(/sans réseau/)).toBeNull();
    expect(screen.getByText('Numérotation qui suit ton carnet papier')).toBeTruthy();
    expect(screen.getByText('Ta palanquée, ton équipement, tes conditions')).toBeTruthy();
    expect(featureTitles()).toEqual([
      'Un vrai carnet',
      'Ta palanquée',
      'Tes sites sur la carte',
      'Ton tableau de bord',
      'Tes données restent à toi',
    ]);
    expect(document.querySelector('[data-count]')?.getAttribute('data-count')).toBe('5');
  });

  it('keeps the offline promises once the app delivers them', async () => {
    stubDesktop();
    renderPublicRoute('/', { offline: true, privacyCopy: PRIVACY });
    await screen.findByRole('heading', { level: 1 });

    expect(screen.getByText('Fonctionne même sans réseau, sur le bateau')).toBeTruthy();
    expect(featureTitles()).toContain('Même sans réseau');
    expect(document.querySelector('[data-count]')?.getAttribute('data-count')).toBe('6');
  });

  it('shows the privacy promise under its fixed title, with the validated text', async () => {
    stubDesktop();
    renderPublicRoute('/', { privacyCopy: PRIVACY });
    await screen.findByRole('heading', { level: 1 });

    const card = document.getElementById('confidentialite');
    expect(card?.textContent).toContain('Tes données restent à toi');
    expect(card?.textContent).toContain(PRIVACY);
  });

  it('leaves the privacy promise and its anchor out without a validated text', async () => {
    stubDesktop();
    renderPublicRoute('/', { privacyCopy: null });
    await screen.findByRole('heading', { level: 1 });

    expect(within(anchorsNav()).queryByRole('link', { name: 'Confidentialité' })).toBeNull();
    expect(document.getElementById('confidentialite')).toBeNull();
    expect(featureTitles()).not.toContain('Tes données restent à toi');
    expect(document.querySelector('[data-count]')?.getAttribute('data-count')).toBe('4');
  });
});

describe('final call to action', () => {
  it('brings the card back on the sign-up tab, its first field focused', async () => {
    stubDesktop();
    const user = userEvent.setup();
    const router = renderPublicRoute('/');
    await screen.findByRole('heading', { level: 2, name: 'Content de te revoir' });

    await user.click(within(finalCta()).getByRole('link', { name: 'Créer mon carnet' }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Ouvre ton carnet' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/signup');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Prénom')));
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it('brings the card back on the sign-in tab', async () => {
    stubDesktop();
    const user = userEvent.setup();
    const router = renderPublicRoute('/');
    await screen.findByRole('heading', { level: 2, name: 'Content de te revoir' });

    await user.click(within(finalCta()).getByRole('link', { name: 'Se connecter' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('E-mail')));
    expect(router.state.location.pathname).toBe('/login');
  });

  it('only signs in while the beta is closed, and says the sign-up is coming', async () => {
    stubDesktop();
    renderPublicRoute('/', { signup: false });
    await screen.findByRole('heading', { level: 1 });

    const links = within(finalCta()).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Se connecter']);
    expect(within(finalCta()).getByText('Les inscriptions ouvrent bientôt.')).toBeTruthy();
  });
});

describe('final call to action and next', () => {
  it('keeps next on its links', async () => {
    stubDesktop();
    renderPublicRoute('/login?next=%2Fstats');
    await screen.findByRole('heading', { level: 2, name: 'Content de te revoir' });

    const hrefs = within(finalCta())
      .getAllByRole('link')
      .map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(['/login?next=%2Fstats', '/signup?next=%2Fstats']);
  });
});

describe('wording of the promises (product owner, 2026-11-26)', () => {
  it('promises the filters and the dive team the app has', async () => {
    stubDesktop();
    renderPublicRoute('/');
    await screen.findByRole('heading', { level: 1 });

    expect(screen.getByText(/filtres par région et profondeur\./)).toBeTruthy();
    expect(
      screen.getByText(
        'Note avec qui tu plonges, et retrouve tes binômes les plus fréquents sur ton tableau de bord.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/combien de fois/)).toBeNull();
  });
});

describe('landing page (< 1024px)', () => {
  it('offers its two ways in instead of the card', async () => {
    renderPublicRoute('/');
    await screen.findByRole('heading', { level: 1 });

    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.queryByLabelText('E-mail')).toBeNull();
    expect(screen.getByRole('link', { name: 'J’ai déjà un compte' }).getAttribute('href')).toBe(
      '/login',
    );
    expect(
      screen
        .getAllByRole('link', { name: 'Créer mon carnet' })
        .map((link) => link.getAttribute('href')),
    ).toEqual(['/signup', '/signup']);
  });
  it('offers only the sign-in while the beta is closed', async () => {
    renderPublicRoute('/', { signup: false });
    await screen.findByRole('heading', { level: 1 });

    expect(screen.queryByRole('link', { name: 'Créer mon carnet' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'J’ai déjà un compte' })).toBeNull();
    expect(screen.getByText('Les inscriptions ouvrent bientôt.')).toBeTruthy();
  });

  it('keeps the section titles for screen readers, only the eyebrows showing', async () => {
    renderPublicRoute('/');
    await screen.findByRole('heading', { level: 1 });

    expect(
      screen.getByRole('heading', { level: 2, name: 'Trois gestes, un carnet toujours à jour' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Pensé par et pour des plongeurs' }),
    ).toBeTruthy();
  });
});
