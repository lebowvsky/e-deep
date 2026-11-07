import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { routes } from '@/app/routes';

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
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

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(menuButton);
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

    await user.click(within(dialog).getByRole('link', { name: 'Carte' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(router.state.location.pathname).toBe('/map');
  });

  it('shows the FAB as a link to a new dive', async () => {
    renderAt('/dashboard');
    const fab = await screen.findByRole('link', { name: 'Nouvelle plongée' });
    expect(fab.getAttribute('href')).toBe('/dives/new');
  });
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
  });
});
