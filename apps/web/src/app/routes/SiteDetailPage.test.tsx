import type { DashboardSite, DiveLogResponse, DiveSummary } from '@e-deep/shared';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import type { Site } from '@/shared/model/site';
import { MOCK_SITES } from '@/shared/sites/mocks/sites';
import { createMemorySitesRepository } from '@/shared/sites/repository/sitesRepository';
import type { MapViewProps } from '@/shared/ui/MapView';
import { ToastProvider } from '@/shared/ui/Toast';
import { fakeApiClient } from '@/test/fakeApiClient';
import { TestProviders } from '@/test/TestProviders';
import { SiteDetailPage } from './SiteDetailPage';

// MapLibre needs WebGL: the mini map is replaced by a labelled box.
vi.mock('@/shared/ui/MapView', () => ({
  MapView: ({ label }: MapViewProps) => <div role="img" aria-label={label} />,
}));

function dive(id: string, number: number, site: Site, depthMaxM: number): DiveSummary {
  return {
    id,
    number,
    date: `2026-0${number}-10T10:00:00+02:00`,
    utcOffsetMinutes: 120,
    site: { id: site.id, name: site.name, locality: null, region: site.region },
    depthMaxM,
    durationMin: 40,
    temperatureC: 14 + number,
    gasMix: 'AIR',
    notes: null,
    buddies: [{ id: 'b1', firstName: 'Lucas', lastName: 'Bernard' }],
  };
}

const LOG: DiveLogResponse = {
  dives: [
    dive('d4', 4, MOCK_SITES.revellata, 42),
    dive('d3', 3, MOCK_SITES.bibliotheque, 28),
    dive('d2', 2, MOCK_SITES.revellata, 35),
    dive('d1', 1, MOCK_SITES.revellata, 30),
  ],
};

const DASHBOARD_SITES: DashboardSite[] = [MOCK_SITES.revellata, MOCK_SITES.bibliotheque].map(
  (site) => ({
    id: site.id,
    name: site.name,
    region: site.region,
    latitude: site.position?.latitude ?? null,
    longitude: site.position?.longitude ?? null,
    diveCount: 1,
    maxDepthM: 30,
  }),
);

async function renderAt(path: string) {
  const repository = createMemorySitesRepository();
  // Types, depths and access notes kept locally; the quick site has no dive nor position.
  for (const site of [MOCK_SITES.revellata, MOCK_SITES.bibliotheque, MOCK_SITES.grotteAuxCorbs]) {
    await repository.save(site);
  }
  const get = vi
    .fn()
    .mockImplementation((apiPath: string) =>
      Promise.resolve(apiPath === 'dives' ? LOG : { sites: DASHBOARD_SITES }),
    );
  const router = createMemoryRouter(
    [
      { path: '/sites/:siteId', element: <SiteDetailPage /> },
      { path: '/map', element: <h1>Carte</h1> },
      { path: '*', element: <h1>Ailleurs</h1> },
    ],
    { initialEntries: [path] },
  );
  render(
    <TestProviders client={fakeApiClient({ get })} sitesRepository={repository}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </TestProviders>,
  );
  return router;
}

const menuButton = () => screen.getByRole('button', { name: 'Plus d’actions' });

describe('SiteDetailPage', () => {
  it('shows the site, its figures, its dives and what to know', async () => {
    await renderAt('/sites/s01');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pointe de la Revellata' }),
    ).toBeTruthy();
    expect(screen.getByText('Site · Tombant · privé')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Carte/ }).getAttribute('href')).toBe('/map?site=s01');
    // In the header (tablet and up) and under the map (phones): one shows at a time (CSS).
    for (const link of screen.getAllByRole('link', { name: 'Nouvelle plongée ici' })) {
      expect(link.getAttribute('href')).toBe('/dives/new?site=s01');
    }
    const kpis = screen.getByRole('list', { name: 'Tes chiffres sur ce site' });
    expect(within(kpis).getByText('3 plongées')).toBeTruthy();
    expect(within(kpis).getByText('42 mètres')).toBeTruthy();
    expect(
      screen.getByRole('img', { name: 'Carte autour de Pointe de la Revellata' }),
    ).toBeTruthy();
    expect(screen.getByText('42.5830° N · 8.7250° E')).toBeTruthy();

    const dives = screen.getByRole('region', { name: /Tes plongées ici/ });
    expect(within(dives).getAllByRole('listitem')).toHaveLength(3);
    expect(
      within(dives)
        .getAllByRole('link', { name: /Voir dans Mes plongées|Tout voir/ })[0]
        ?.getAttribute('href'),
    ).toBe('/dives?site=s01');
    expect(screen.getByText('15 – 60 m')).toBeTruthy();
    expect(screen.getByText(/Mouillage au pied du phare/)).toBeTruthy();
  });

  it('says that a site is unknown or deleted', async () => {
    await renderAt('/sites/nope');

    expect(
      await screen.findByRole('heading', { name: 'Ce site n’existe pas ou a été supprimé' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour à la carte' }).getAttribute('href')).toBe(
      '/map',
    );
  });

  it('offers to place a site without position', async () => {
    await renderAt('/sites/s24');

    await screen.findByRole('heading', { level: 1, name: 'Revellata — Grotte aux Corbs' });
    expect(screen.getByText('Position à préciser')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Placer sur la carte' }).getAttribute('href')).toBe(
      '/map?panel=place&id=s24',
    );
  });

  it('opens the « … » menu with the keyboard and closes it with Échap', async () => {
    const user = userEvent.setup();
    await renderAt('/sites/s01');
    await screen.findByRole('heading', { level: 1 });

    menuButton().focus();
    await user.keyboard('{ArrowDown}');
    const menu = screen.getByRole('menu', { name: 'Actions du site' });
    expect(document.activeElement).toBe(within(menu).getAllByRole('menuitem')[0]);
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(
      within(menu).getByRole('menuitem', { name: 'Supprimer le site' }),
    );
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(menuButton());
  });

  it('merges the site into another one: its dives go there, then its page', async () => {
    const user = userEvent.setup();
    const router = await renderAt('/sites/s02');
    await screen.findByRole('heading', { level: 1, name: 'La Bibliothèque' });

    await user.click(menuButton());
    await user.click(screen.getByRole('menuitem', { name: 'Fusionner avec un autre site…' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Fusionner « La Bibliothèque » avec…' });
    await user.type(within(dialog).getByRole('combobox', { name: /Site cible/ }), 'revelata');
    await user.click(within(dialog).getByRole('option', { name: /Pointe de la Revellata/ }));
    expect(within(dialog).getByRole('status').textContent).toBe(
      'La plongée de La Bibliothèque sera rattachée à Pointe de la Revellata. Les infos de Pointe de la Revellata sont conservées ; les champs vides de Pointe de la Revellata sont complétés avec ceux de La Bibliothèque. La Bibliothèque sera supprimé. Action irréversible.',
    );

    await user.click(within(dialog).getByRole('button', { name: 'Fusionner' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/sites/s01'));
    expect(
      await screen.findByText('« La Bibliothèque » fusionné avec « Pointe de la Revellata »'),
    ).toBeTruthy();
    const kpis = await screen.findByRole('list', { name: 'Tes chiffres sur ce site' });
    expect(within(kpis).getByText('4 plongées')).toBeTruthy();
  });

  it('refuses to delete a site with dives, and offers to merge it', async () => {
    const user = userEvent.setup();
    await renderAt('/sites/s01');
    await screen.findByRole('heading', { level: 1 });

    await user.click(menuButton());
    await user.click(screen.getByRole('menuitem', { name: 'Supprimer le site' }));
    const dialog = screen.getByRole('alertdialog', {
      name: 'Supprimer « Pointe de la Revellata » ?',
    });
    expect(
      within(dialog).getByText(
        'Ce site a 3 plongées : fusionne-le avec un autre site pour ne pas les perdre.',
      ),
    ).toBeTruthy();

    await user.click(within(dialog).getByRole('button', { name: 'Fusionner…' }));
    expect(
      screen.getByRole('alertdialog', { name: /^Fusionner « Pointe de la Revellata »/ }),
    ).toBeTruthy();
  });

  it('deletes a site without dive, back to the map', async () => {
    const user = userEvent.setup();
    const router = await renderAt('/sites/s24');
    await screen.findByRole('heading', { level: 1 });

    await user.click(menuButton());
    await user.click(screen.getByRole('menuitem', { name: 'Supprimer le site' }));
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Supprimer' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/map'));
    expect(await screen.findByText('Site « Revellata — Grotte aux Corbs » supprimé')).toBeTruthy();
  });
});
