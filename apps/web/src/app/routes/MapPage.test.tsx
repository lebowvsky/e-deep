import type { DiveLogResponse, DiveSummary } from '@e-deep/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Site } from '@/shared/model/site';
import { MOCK_SITES } from '@/shared/sites/mocks/sites';
import { createMemorySitesRepository } from '@/shared/sites/mocks/memorySitesRepository';
import type { MapViewProps } from '@/shared/ui/MapView';
import { ToastProvider } from '@/shared/ui/Toast';
import { fakeApiClient } from '@/test/fakeApiClient';
import { TestProviders } from '@/test/TestProviders';
import { MapPage } from './MapPage';

// The `sites` given to the map at each render (memoisation check).
const mapRenders = vi.hoisted(() => ({ sites: [] as unknown[] }));

// MapLibre needs WebGL: the map is replaced by its markers as buttons, and a button that places.
vi.mock('@/shared/ui/MapView', () => ({
  MapView: ({ sites, selectedId, onSelect, pick, popover }: MapViewProps) => {
    mapRenders.sites.push(sites);
    return (
      <div data-testid="map">
        {sites.map((site) => (
          <button
            key={site.id}
            type="button"
            aria-label={`Repère ${site.name}`}
            aria-pressed={site.id === selectedId}
            onClick={() => onSelect?.(site.id)}
          />
        ))}
        {pick && (
          <button
            type="button"
            onClick={() => pick.onPick({ latitude: 42.5794, longitude: 8.7262 })}
          >
            Cliquer sur la carte
          </button>
        )}
        {popover}
      </div>
    );
  },
}));

const SITES: Site[] = [MOCK_SITES.revellata, MOCK_SITES.bibliotheque, MOCK_SITES.liban];

function dive(id: string, number: number, site: Site, depthMaxM: number): DiveSummary {
  return {
    id,
    number,
    date: `2026-0${number}-10T10:00:00+02:00`,
    utcOffsetMinutes: 120,
    site: { id: site.id, name: site.name, locality: null, region: site.region },
    depthMaxM,
    durationMin: 40,
    temperatureC: 15,
    gasMix: 'AIR',
    notes: null,
    buddies: [],
    entryType: null,
    diveCenter: null,
  };
}

const LOG: DiveLogResponse = {
  dives: [
    dive('d5', 5, MOCK_SITES.revellata, 42),
    dive('d4', 4, MOCK_SITES.liban, 32),
    dive('d3', 3, MOCK_SITES.revellata, 38),
    dive('d2', 2, MOCK_SITES.bibliotheque, 28),
    dive('d1', 1, MOCK_SITES.revellata, 30),
  ],
};

function renderPage(path: string) {
  const get = vi
    .fn()
    .mockImplementation((apiPath: string) =>
      apiPath === 'dives' ? Promise.resolve(LOG) : Promise.reject(new Error(apiPath)),
    );
  // The sites of the log, and the quick site without position nor dive.
  const sitesRepository = createMemorySitesRepository({
    sites: [...SITES, MOCK_SITES.grotteAuxCorbs],
  });
  const router = createMemoryRouter(
    [
      { path: '/map', element: <MapPage /> },
      { path: '*', element: <h1>Ailleurs</h1> },
    ],
    { initialEntries: [path] },
  );
  render(
    <TestProviders client={fakeApiClient({ get })} sitesRepository={sitesRepository}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </TestProviders>,
  );
  return { router, get };
}

async function renderAt(path: string) {
  const { router } = renderPage(path);
  await screen.findByTestId('map');
  return router;
}

const list = () => screen.getByRole('region', { name: 'Liste de mes sites' });
/** The row buttons of the list (id `site-item-…`). */
const rows = () => [...list().querySelectorAll<HTMLButtonElement>('[id^="site-item-"]')];
/** Names of the rows: the first line of each row (count, then name and meta). */
const rowNames = () =>
  rows().map((row) => row.querySelectorAll(':scope > span')[1]?.firstElementChild?.textContent);

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('MapPage — list and map', () => {
  it('shows the header counters and the sites, most dived first', async () => {
    await renderAt('/map');

    expect(screen.getByText('Carte · 4 sites · 2 régions')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Mes sites' })).toBeTruthy();
    expect(screen.getByText('1 site attend sa position.')).toBeTruthy();
    // Ties (1 dive each) by name.
    expect(rowNames()).toStrictEqual([
      'Pointe de la Revellata',
      'Épave du Liban',
      'La Bibliothèque',
      'Revellata — Grotte aux Corbs',
    ]);
    // Only the placed sites are on the map.
    expect(within(screen.getByTestId('map')).getAllByRole('button')).toHaveLength(3);
    expect(rows()).toHaveLength(4);
  });

  it('keeps the list and the map in step, and the selection in the URL', async () => {
    const user = userEvent.setup();
    const router = await renderAt('/map');

    await user.click(within(list()).getByRole('button', { name: /Épave du Liban/ }));
    expect(router.state.location.search).toBe('?site=s07');
    expect(
      screen.getByRole('button', { name: 'Repère Épave du Liban' }).getAttribute('aria-pressed'),
    ).toBe('true');
    // The preview of the selected site, and its row, lead to its page.
    const map = within(screen.getByTestId('map'));
    expect(map.getByRole('link', { name: /Voir la fiche/ }).getAttribute('href')).toBe(
      '/sites/s07',
    );
    const row = within(list()).getByRole('link', { name: 'Voir la fiche de Épave du Liban' });
    expect(row.getAttribute('href')).toBe('/sites/s07');

    await user.click(screen.getByRole('button', { name: 'Repère La Bibliothèque' }));
    expect(router.state.location.search).toBe('?site=s02');
    expect(
      within(list())
        .getByRole('button', { name: /La Bibliothèque/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('offers to place a site without position once selected', async () => {
    const user = userEvent.setup();
    const router = await renderAt('/map');

    await user.click(within(list()).getByRole('button', { name: /Revellata — Grotte aux Corbs/ }));
    await user.click(screen.getByRole('button', { name: 'Placer sur la carte' }));

    expect(router.state.location.search).toBe('?site=s24&panel=place&id=s24');
    expect(screen.getByRole('dialog', { name: 'Placer le site' })).toBeTruthy();
  });

  it('filters by type, region and « À compléter », and sorts', async () => {
    const user = userEvent.setup();
    await renderAt('/map');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Type de site' }), 'epave');
    expect(rowNames()).toStrictEqual(['Épave du Liban']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type de site' }), 'all');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Région' }), 'Marseille');
    expect(rowNames()).toStrictEqual(['Épave du Liban']);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Région' }), 'all');

    const toComplete = screen.getByRole('button', { name: 'À compléter 1' });
    expect(toComplete.getAttribute('aria-pressed')).toBe('false');
    await user.click(toComplete);
    expect(toComplete.getAttribute('aria-pressed')).toBe('true');
    expect(rowNames()).toStrictEqual(['Revellata — Grotte aux Corbs']);
    await user.click(toComplete);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Trier les sites' }), 'depth');
    expect(rowNames()).toStrictEqual([
      'Pointe de la Revellata',
      'Épave du Liban',
      'La Bibliothèque',
      'Revellata — Grotte aux Corbs',
    ]);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Trier les sites' }), 'name');
    expect(rowNames()[0]).toBe('Épave du Liban');

    await user.type(screen.getByRole('searchbox', { name: 'Rechercher un site' }), 'revelata');
    expect(rowNames()).toStrictEqual(['Pointe de la Revellata', 'Revellata — Grotte aux Corbs']);
  });

  it('chooses a zone among those that have sites, with the arrows too', async () => {
    const user = userEvent.setup();
    const router = await renderAt('/map');

    const zones = screen.getByRole('radiogroup', { name: 'Zone de la carte' });
    const radios = within(zones).getAllByRole('radio');
    expect(radios.map((radio) => radio.textContent)).toStrictEqual(['Tous4', 'Méditerranée4']);
    expect(radios[0]?.getAttribute('aria-checked')).toBe('true');

    radios[0]?.focus();
    await user.keyboard('{ArrowRight}');
    expect(router.state.location.search).toBe('?zone=mediterranee');
    expect(document.activeElement).toBe(radios[1]);
    expect(radios[1]?.getAttribute('aria-checked')).toBe('true');
  });
});

describe('MapPage — states forced by ?state= (development)', () => {
  it('shows the loading state without reading the API', async () => {
    const { get } = renderPage('/map?state=loading');

    expect(await screen.findByText('Chargement de tes sites…')).toBeTruthy();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(get).not.toHaveBeenCalled();
  });

  it('shows the empty state', async () => {
    renderPage('/map?state=empty');

    expect(await screen.findByText('Aucun site pour l’instant')).toBeTruthy();
    expect(screen.getByText('Carte · 0 site · 0 région')).toBeTruthy();
  });

  it('shows the error state', async () => {
    renderPage('/map?state=error');

    expect(
      within(await screen.findByRole('alert')).getByText('Tes sites n’ont pas pu être chargés.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('reads the API for ?state=ready', async () => {
    await renderAt('/map?state=ready');

    expect(rows()).toHaveLength(4);
  });
});

describe('MapPage — performance', () => {
  it('gives the map the same sites while only the hover or the selection changes', async () => {
    const user = userEvent.setup();
    await renderAt('/map');
    const before = mapRenders.sites.at(-1);
    const renders = mapRenders.sites.length;

    await user.hover(within(list()).getByRole('button', { name: /Épave du Liban/ }));
    await user.click(within(list()).getByRole('button', { name: /La Bibliothèque/ }));

    // The map rendered again (hover, selection), with the very same array: no new GeoJSON.
    expect(mapRenders.sites.length).toBeGreaterThan(renders);
    expect(mapRenders.sites.slice(renders).every((sites) => sites === before)).toBe(true);
  });
});

describe('MapPage — site panel', () => {
  it('adds a site: coordinates pasted, region suggested, saved in the list', async () => {
    const user = userEvent.setup();
    const router = await renderAt('/map');

    await user.click(screen.getByRole('button', { name: 'Ajouter un site' }));
    const panel = screen.getByRole('dialog', { name: 'Nouveau site' });
    const latitude = within(panel).getByRole('textbox', { name: 'Latitude' });
    expect(document.activeElement).toBe(latitude);

    fireEvent.paste(latitude, { clipboardData: { getData: () => '42.5794, 8.7262' } });
    expect((latitude as HTMLInputElement).value).toBe('42.5794');
    expect(within(panel).getByRole<HTMLInputElement>('textbox', { name: 'Longitude' }).value).toBe(
      '8.7262',
    );
    // 400 m from the Revellata.
    expect(within(panel).getByRole<HTMLInputElement>('combobox', { name: /^Région/ }).value).toBe(
      'Calvi · Corse',
    );
    expect(within(panel).getByText('Suggérée depuis la position')).toBeTruthy();

    await user.type(within(panel).getByRole('textbox', { name: /^Nom/ }), 'Le Tombant du Phare');
    await user.click(within(panel).getByRole('button', { name: 'Grotte' }));
    await user.click(within(panel).getByRole('button', { name: 'Enregistrer le site' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Nouveau site' })).toBeNull());
    expect(router.state.location.search).toMatch(/^\?site=[\w-]+$/);
    expect(rowNames()).toContain('Le Tombant du Phare');
    expect(screen.getByText('Site « Le Tombant du Phare » enregistré')).toBeTruthy();
  });

  it('wants a name', async () => {
    const user = userEvent.setup();
    await renderAt('/map?panel=new');

    await user.click(screen.getByRole('button', { name: 'Enregistrer le site' }));
    expect(screen.getByText('Donne un nom au site.')).toBeTruthy();
  });

  it('places a quick site with a click on the map; the fields follow', async () => {
    const user = userEvent.setup();
    await renderAt('/map?panel=place&id=s24');

    const panel = screen.getByRole('dialog', { name: 'Placer le site' });
    expect(within(panel).getByText('Compléter un site express')).toBeTruthy();
    expect(within(panel).getByRole<HTMLInputElement>('textbox', { name: /^Nom/ }).value).toBe(
      'Revellata — Grotte aux Corbs',
    );
    await user.click(screen.getByRole('button', { name: 'Cliquer sur la carte' }));
    expect(within(panel).getByRole<HTMLInputElement>('textbox', { name: 'Latitude' }).value).toBe(
      '42.5794',
    );
    expect(screen.getByText(/42\.5794° N · 8\.7262° E/)).toBeTruthy();
  });

  it('asks before closing with changes: Rester keeps the panel, Quitter closes it', async () => {
    const user = userEvent.setup();
    const router = await renderAt('/map?panel=edit&id=s01');

    const panel = screen.getByRole('dialog', { name: 'Modifier le site' });
    await user.type(within(panel).getByRole('textbox', { name: /^Nom/ }), ' Nord');
    await user.click(within(panel).getByRole('button', { name: 'Fermer le panneau' }));

    const confirm = await screen.findByRole('alertdialog', { name: 'Quitter sans enregistrer ?' });
    await user.click(within(confirm).getByRole('button', { name: 'Rester' }));
    expect(screen.getByRole('dialog', { name: 'Modifier le site' })).toBeTruthy();

    await user.keyboard('{Escape}');
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Quitter' }),
    );
    await waitFor(() => expect(router.state.location.search).toBe(''));
    expect(screen.queryByRole('dialog', { name: 'Modifier le site' })).toBeNull();
  });

  it('closes at once without changes', async () => {
    const user = userEvent.setup();
    const router = await renderAt('/map?panel=edit&id=s01');

    await user.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(router.state.location.search).toBe('');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
