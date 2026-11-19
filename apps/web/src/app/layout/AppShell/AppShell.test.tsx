import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { routes } from '@/app/routes';
import { TestProviders } from '@/test/TestProviders';
import { fakeApiClient } from '@/test/fakeApiClient';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  // These tests are about the shell: the dashboard stays loading (API call never settles).
  const get = vi.fn(() => new Promise<never>(() => undefined));
  render(
    <TestProviders client={fakeApiClient({ get })}>
      <RouterProvider router={router} />
    </TestProviders>,
  );
  return router;
}

/** jsdom has no matchMedia: stub it to simulate a ≥ 768px viewport. */
function stubTabletUp() {
  vi.stubGlobal('matchMedia', (query: string): Partial<MediaQueryList> => ({
    matches: true,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('AppShell — mobile', () => {
  it('redirects / to the dashboard', async () => {
    const router = renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('opens the drawer, closes it with Esc and gives focus back to the menu button', async () => {
    const user = userEvent.setup();
    renderAt('/dashboard');

    const menuButton = await screen.findByRole('button', { name: 'Ouvrir le menu' });
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');

    await user.click(menuButton);
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');

    expect(document.querySelector('main')?.hasAttribute('inert')).toBe(true);

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(menuButton);
    expect(document.querySelector('main')?.hasAttribute('inert')).toBe(false);
    expect(document.body.style.overflow).toBe('');
  });

  it('keeps Tab inside the drawer', async () => {
    const user = userEvent.setup();
    renderAt('/dashboard');

    await user.click(await screen.findByRole('button', { name: 'Ouvrir le menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    const logout = within(dialog).getByRole('link', { name: 'Déconnexion' });

    logout.focus();
    await user.tab();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes the drawer when navigating and marks the current page', async () => {
    const user = userEvent.setup();
    const router = renderAt('/dashboard');

    await user.click(await screen.findByRole('button', { name: 'Ouvrir le menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    const current = within(dialog).getByRole('link', { name: 'Dashboard' });
    expect(current.getAttribute('aria-current')).toBe('page');

    // A page rendered at once (the map page loads its own chunk).
    await user.click(within(dialog).getByRole('link', { name: 'Statistiques' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/stats');
    // Focus moves to the new content and the document title follows.
    expect(document.activeElement).toBe(document.querySelector('main'));
    expect(document.title).toBe('Statistiques · E-Deep');
  });

  it('shows the FAB as a link to a new dive', async () => {
    renderAt('/dashboard');
    const fab = await screen.findByRole('link', { name: 'Nouvelle plongée' });
    expect(fab.getAttribute('href')).toBe('/dives/new');
  });
});

describe('AppShell — FAB', () => {
  it('hides the FAB on a dive detail', async () => {
    renderAt('/dives/d127');
    await screen.findByRole('button', { name: 'Ouvrir le menu' });
    expect(screen.queryByRole('link', { name: 'Nouvelle plongée' })).toBeNull();
  });

  it.each(['/dives/new', '/dives/new?from=d127', '/dives/d127/edit'])(
    'leaves the phone bars to the dive form on %s: no app top bar, no FAB',
    async (path) => {
      renderAt(path);
      // The form's own top bar, shown while the log loads.
      const close = await screen.findByRole('link', { name: 'Annuler' });
      expect(close.getAttribute('href')).toMatch(/^\/dives/);
      expect(screen.queryByRole('button', { name: 'Ouvrir le menu' })).toBeNull();
      expect(screen.queryByRole('link', { name: 'Nouvelle plongée' })).toBeNull();
    },
  );
});

describe('AppShell — tablet and up', () => {
  it('renders the sidebar navigation instead of the top bar', async () => {
    stubTabletUp();
    renderAt('/dashboard');

    const nav = await screen.findByRole('navigation', { name: 'Navigation principale' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(screen.queryByRole('button', { name: 'Ouvrir le menu' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Nouvelle plongée' })).toBeNull();
  });

  it('toggles the user menu', async () => {
    stubTabletUp();
    const user = userEvent.setup();
    renderAt('/dashboard');

    const toggle = await screen.findByRole('button', { name: 'Menu du compte' });
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', { name: 'Paramètres' }).getAttribute('href')).toBe('/settings');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('link', { name: 'Paramètres' })).toBeNull();
    expect(document.activeElement).toBe(toggle);
  });
});

describe('AppShell — navigation of a section', () => {
  it('marks « Carte » as the location on a site page', async () => {
    stubTabletUp();
    renderAt('/sites/s01');

    const nav = await screen.findByRole('navigation', { name: 'Navigation principale' });
    const map = within(nav).getByRole('link', { name: 'Carte' });
    expect(map.getAttribute('aria-current')).toBe('location');
    expect(
      within(nav).getByRole('link', { name: 'Dashboard' }).getAttribute('aria-current'),
    ).toBeNull();
  });
});
