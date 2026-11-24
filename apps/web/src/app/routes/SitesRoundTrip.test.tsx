import { QueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDiveApi, type FakeDiveApi } from '@/features/dives/mocks/fakeDiveApi';
import { isRecord } from '@/shared/lib/guards';
import { createHttpSitesRepository } from '@/shared/sites/api/httpSitesRepository';
import { isSiteListResponse } from '@/shared/sites/api/siteContract';
import { mockSites } from '@/shared/sites/mocks/sites';
import type { MapViewProps } from '@/shared/ui/MapView';
import { ToastProvider } from '@/shared/ui/Toast';
import { TestProviders } from '@/test/TestProviders';
import { DiveDetailPage } from './DiveDetailPage';
import { DiveFormPage } from './DiveFormPage';
import { MapPage } from './MapPage';
import { SiteDetailPage } from './SiteDetailPage';

// MapLibre needs WebGL: the map is replaced by its markers.
vi.mock('@/shared/ui/MapView', () => ({
  MapView: ({ sites, label }: MapViewProps) => (
    <div role="img" aria-label={label ?? 'Carte'}>
      {sites.length}
    </div>
  ),
}));

/**
 * The screens over a fake API (dives and sites, one state): what is written is what the next reads
 * serve, as after a reload. Each page starts from a fresh cache (`renderPage`), the API remains.
 */
function renderPage(api: FakeDiveApi, path: string) {
  const router = createMemoryRouter(
    [
      { path: '/dives/new', element: <DiveFormPage /> },
      { path: '/dives/:diveId', element: <DiveDetailPage /> },
      { path: '/map', element: <MapPage /> },
      { path: '/sites/:siteId', element: <SiteDetailPage /> },
      { path: '*', element: null },
    ],
    { initialEntries: [path] },
  );
  // Cached for good: only the invalidations of the writes make the pages read again.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
  });
  const view = render(
    <TestProviders
      client={api.client}
      sitesRepository={createHttpSitesRepository(api.client)}
      queryClient={queryClient}
    >
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </TestProviders>,
  );
  return { router, unmount: view.unmount };
}

/** The sites the API serves now. */
async function apiSites(api: FakeDiveApi) {
  const { sites } = await api.client.get('sites', isSiteListResponse);
  return sites;
}

const field = (name: string | RegExp) => screen.getByLabelText<HTMLInputElement>(name);
const heading = () => screen.findByRole('heading', { level: 1 });
const diveCount = () =>
  within(screen.getByRole('list', { name: 'Tes chiffres sur ce site' })).getByText(/plongées?$/)
    .textContent;

beforeEach(() => {
  localStorage.clear();
  // jsdom does not scroll.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('sites round trip: quick creation → dive → site page → edit → merge → deletion', () => {
  it('keeps every write of the sites on the API', { timeout: 20_000 }, async () => {
    const user = userEvent.setup();
    // The sites of the mocked log, plus « Revellata — Grotte aux Corbs », without dive.
    const api = createFakeDiveApi({ sites: mockSites });

    // 1. Quick creation from the dive form: `POST /sites`, then the dive saved on that site.
    let page = renderPage(api, '/dives/new');
    await screen.findByRole('form', { name: 'Nouvelle plongée' });
    await user.type(screen.getByRole('combobox', { name: /^Site/ }), 'Tombant du Phare');
    await user.keyboard('{Enter}');
    const quick = screen.getByRole('dialog', { name: 'Nouveau site' });
    await user.click(within(quick).getByRole('button', { name: 'Tombant' }));
    await user.click(within(quick).getByRole('button', { name: 'Créer et sélectionner' }));
    await waitFor(() => expect(document.activeElement).toBe(field(/^Date/)));
    fireEvent.change(field(/^Date/), { target: { value: '2026-04-10' } });
    fireEvent.change(field(/^Immersion/), { target: { value: '10:05' } });
    fireEvent.change(field(/^Sortie/), { target: { value: '10:49' } });
    fireEvent.change(field(/^Profondeur max/), { target: { value: '31' } });
    await user.click(
      screen.getAllByRole('button', { name: 'Enregistrer la plongée' })[0] ?? document.body,
    );
    await waitFor(() => expect(page.router.state.location.pathname).not.toBe('/dives/new'));
    const diveId = page.router.state.location.pathname.slice('/dives/'.length);
    const created = (await apiSites(api)).find(({ name }) => name === 'Tombant du Phare');
    if (!created) throw new Error('The site was not created');
    expect(created).toMatchObject({
      createdVia: 'quick',
      type: 'tombant',
      locality: 'Calvi',
      region: 'Corse',
    });
    const dive = api.requests.find(({ method, path }) => method === 'POST' && path === 'dives');
    expect(isRecord(dive?.body) && dive.body.site).toStrictEqual({
      id: created.id,
      name: 'Tombant du Phare',
      isNew: false,
    });
    page.unmount();

    // 2. Its page, read back from the API: the dive is there.
    page = renderPage(api, `/sites/${created.id}`);
    expect((await heading()).textContent).toBe('Tombant du Phare');
    expect(diveCount()).toBe('1 plongée');
    page.unmount();

    // 3. Edit on the map: renamed, and the label of its place changed (D-32).
    page = renderPage(api, `/map?panel=edit&id=${created.id}`);
    const panel = await screen.findByRole('dialog', { name: 'Modifier le site' });
    const name = within(panel).getByRole('textbox', { name: /^Nom/ });
    await user.clear(name);
    await user.type(name, 'Tombant du Grand Phare');
    await user.click(within(panel).getByRole('button', { name: 'Enregistrer le site' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Modifier le site' })).toBeNull(),
    );
    page.unmount();
    // A reload reads the new name, on the site and on its dive.
    page = renderPage(api, `/dives/${diveId}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tombant du Grand Phare' }),
    ).toBeTruthy();
    page.unmount();

    // 4. Merge into the Revellata: the dive follows the target, the source is gone.
    page = renderPage(api, '/sites/s01');
    await heading();
    const before = Number.parseInt(diveCount() ?? '', 10);
    page.unmount();
    page = renderPage(api, `/sites/${created.id}`);
    await heading();
    await user.click(screen.getByRole('button', { name: 'Plus d’actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Fusionner avec un autre site…' }));
    const merge = screen.getByRole('alertdialog', {
      name: /^Fusionner « Tombant du Grand Phare »/,
    });
    await user.type(within(merge).getByRole('combobox', { name: /Site cible/ }), 'revelata');
    await user.click(within(merge).getByRole('option', { name: /Pointe de la Revellata/ }));
    await user.click(within(merge).getByRole('button', { name: 'Fusionner' }));
    await waitFor(() => expect(page.router.state.location.pathname).toBe('/sites/s01'));
    await waitFor(() => expect(diveCount()).toBe(`${before + 1} plongées`));
    page.unmount();
    expect((await apiSites(api)).some(({ id }) => id === created.id)).toBe(false);
    page = renderPage(api, `/dives/${diveId}`);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pointe de la Revellata' }),
    ).toBeTruthy();
    page.unmount();

    // 5. Deletion: refused for a site with dives (the merge is offered), done for one without.
    page = renderPage(api, '/sites/s01');
    await heading();
    await user.click(screen.getByRole('button', { name: 'Plus d’actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Supprimer le site' }));
    const refused = screen.getByRole('alertdialog', {
      name: 'Supprimer « Pointe de la Revellata » ?',
    });
    expect(within(refused).getByRole('button', { name: 'Fusionner…' })).toBeTruthy();
    page.unmount();

    page = renderPage(api, '/sites/s24');
    await heading();
    await user.click(screen.getByRole('button', { name: 'Plus d’actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Supprimer le site' }));
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Supprimer' }),
    );
    await waitFor(() => expect(page.router.state.location.pathname).toBe('/map'));
    page.unmount();
    expect(api.requests.filter(({ method }) => method === 'DELETE')).toStrictEqual([
      { method: 'DELETE', path: 'sites/s24' },
    ]);
    expect((await apiSites(api)).some(({ id }) => id === 's24')).toBe(false);
  });
});
