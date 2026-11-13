import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_QUERY } from '@/features/dives/lib/query';
import { selectDives } from '@/features/dives/lib/selectDives';
import { mockDiveLogResponse } from '@/features/dives/mocks/diveLogResponse';
import { mockDives } from '@/features/dives/mocks/dives';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import { ToastProvider } from '@/shared/ui/Toast';
import { TestProviders } from '@/test/TestProviders';
import { DivesPage } from './DivesPage';

function Location() {
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
}

function renderAt(
  path: string,
  get: ApiClient['get'] = vi.fn().mockResolvedValue(mockDiveLogResponse),
) {
  return render(
    <TestProviders client={{ get }}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/dives"
              element={
                <>
                  <DivesPage />
                  <Location />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </TestProviders>,
  );
}

const search = () => screen.getByTestId('search').textContent;

/** The page live region (the toasts have their own). */
const liveRegion = () =>
  first(screen.getAllByRole('status').filter((region) => region.tagName === 'P'));

function first<T>(items: T[]): T {
  const [item] = items;
  if (item === undefined) throw new Error('No element');
  return item;
}

/** The desktop filter button (the phone chip of the same name opens the sheet). */
const filterButton = (name: string) =>
  first(
    screen
      .getAllByRole('button', { name })
      .filter((button) => button.hasAttribute('aria-expanded')),
  );

describe('DivesPage', () => {
  it('shows the first page of the log, grouped by month, most recent first', async () => {
    renderAt('/dives');

    expect(await screen.findByRole('table')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Mes plongées' })).toBeTruthy();
    expect(screen.getByText(/127 plongées depuis juin 2019/)).toBeTruthy();

    const dateHeader = screen.getByRole('columnheader', { name: /Date/ });
    expect(dateHeader.getAttribute('aria-sort')).toBe('descending');
    const months = screen.getAllByRole('rowheader').map((cell) => cell.textContent);
    expect(months).toEqual([
      'Avril 20264 plongées · 2 h 57',
      'Mars 20263 plongées · 1 h 57',
      'Février 20262 plongées · 1 h 09',
      'Décembre 20251 plongée · 0 h 44',
    ]);
    const links = screen
      .getAllByRole('link', { name: /./ })
      .filter((link) => link.closest('tbody'));
    expect(links).toHaveLength(10);
    expect(links[0]?.getAttribute('href')).toBe('/dives/d127');
    // Desktop table and phone cards are both in the DOM (CSS picks one): two paginations.
    expect(screen.getAllByText('1–10')).toHaveLength(2);
  });

  it('filters from a popover, announces the result and writes it in the URL', async () => {
    const user = userEvent.setup();
    renderAt('/dives?page=3');
    await screen.findByRole('table');

    await user.click(filterButton('Région'));
    const popover = screen.getByRole('dialog', { name: 'Filtre Région' });
    await user.click(within(popover).getByRole('button', { name: /Corse/ }));

    expect(search()).toBe('?region=corse');
    expect(screen.getByText('31 plongées dans la sélection').getAttribute('role')).toBe('status');
    expect(filterButton('Région, filtre actif')).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Filtre Région' })).toBeNull();
    expect(document.activeElement).toBe(filterButton('Région, filtre actif'));

    await user.click(screen.getByRole('button', { name: 'Retirer le filtre Région : Corse' }));
    expect(search()).toBe('');
  });

  it('focuses the search with « / » and searches as you type', async () => {
    const user = userEvent.setup();
    renderAt('/dives');
    await screen.findByRole('table');

    await user.keyboard('/');
    const field = screen.getByRole('searchbox', { name: 'Rechercher dans le carnet' });
    expect(document.activeElement).toBe(field);
    await user.keyboard('épave liban');
    expect((field as HTMLInputElement).value).toBe('épave liban');
    const sites = within(screen.getByRole('table')).getAllByRole('link');
    expect(sites.length).toBeGreaterThan(0);
    expect(sites.every((link) => link.textContent?.startsWith('Épave du Liban,') === true)).toBe(
      true,
    );
    expect(screen.getByText('Recherche « épave liban »')).toBeTruthy();
  });

  it('pages, sorts and changes the page size', async () => {
    const user = userEvent.setup();
    renderAt('/dives');
    await screen.findByRole('table');

    await user.click(first(screen.getAllByRole('button', { name: 'Page suivante' })));
    expect(search()).toBe('?page=2');
    expect(
      first(screen.getAllByRole('button', { name: 'Page 2' })).getAttribute('aria-current'),
    ).toBe('page');

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Trier les plongées' }),
      'Plus profondes',
    );
    expect(search()).toBe('?sort=-depth');
    const depthHeader = screen.getByRole('columnheader', { name: /Prof\. max/ });
    expect(depthHeader.getAttribute('aria-sort')).toBe('descending');
    expect(screen.queryAllByRole('rowheader')).toHaveLength(0);

    await user.selectOptions(
      first(screen.getAllByRole('combobox', { name: 'Plongées par page' })),
      '20',
    );
    expect(search()).toBe('?sort=-depth&size=20');
  });

  it('filters on phones through the sheet: draft, live counter, apply', async () => {
    const user = userEvent.setup();
    renderAt('/dives?page=2');
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Filtres' }));
    const sheet = screen.getByRole('dialog', { name: 'Filtres' });
    expect(within(sheet).getByRole('button', { name: 'Afficher 127 plongées' })).toBeTruthy();

    await user.click(within(sheet).getByRole('button', { name: /Corse/ }));
    await user.click(within(sheet).getByRole('button', { name: /Lucas Bernard/ }));
    // Live counter, but nothing applied yet.
    const expected = selectDives(mockDives, {
      ...DEFAULT_QUERY,
      regions: ['corse'],
      with: ['b1'],
    }).total;
    const apply = within(sheet).getByRole('button', { name: `Afficher ${expected} plongées` });
    expect(search()).toBe('?page=2');

    await user.click(apply);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(search()).toBe('?region=corse&with=b1');
  });

  it('resets only the draft of the sheet and closes it with Esc without applying', async () => {
    const user = userEvent.setup();
    renderAt('/dives?region=bretagne');
    await screen.findByRole('table');

    const opener = screen.getByRole('button', { name: /^Filtres/ });
    await user.click(opener);
    const sheet = screen.getByRole('dialog', { name: 'Filtres' });
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(document.body.style.overflow).toBe('hidden');
    expect(within(sheet).getByRole('button', { name: 'Afficher 17 plongées' })).toBeTruthy();

    await user.click(within(sheet).getByRole('button', { name: 'Réinitialiser' }));
    expect(within(sheet).getByRole('button', { name: 'Afficher 127 plongées' })).toBeTruthy();
    expect(search()).toBe('?region=bretagne');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(search()).toBe('?region=bretagne');
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(opener);
  });

  it('opens the sheet from a shortcut chip', async () => {
    const user = userEvent.setup();
    renderAt('/dives');
    await screen.findByRole('table');

    const chip = first(
      screen
        .getAllByRole('button', { name: 'Profondeur' })
        .filter((button) => !button.hasAttribute('aria-expanded')),
    );
    await user.click(chip);
    expect(screen.getByRole('dialog', { name: 'Filtres' })).toBeTruthy();
    expect(screen.getByRole('slider', { name: 'Profondeur minimale' })).toBeTruthy();
  });

  it('shows a skeleton while loading', () => {
    renderAt('/dives?state=loading');
    expect(screen.getByText('Chargement du carnet').getAttribute('role')).toBe('status');
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('invites to log the first dive when the log is blank', async () => {
    const user = userEvent.setup();
    renderAt('/dives?state=empty');

    expect(screen.getByRole('heading', { name: 'Ton carnet est vierge' })).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Enregistrer ma première plongée' }).getAttribute('href'),
    ).toBe('/dives/new');
    // No toolbar, no summary, no header actions: the card holds the CTAs.
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Exporter' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Importer (UDDF, CSV)' }));
    expect(screen.getByText('Bientôt disponible')).toBeTruthy();
  });

  it('announces a loading error and keeps the focus in the page on retry', async () => {
    const user = userEvent.setup();
    const get = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('network', 'The API is unreachable.'))
      .mockResolvedValueOnce(mockDiveLogResponse);
    renderAt('/dives', get);

    // One persistent live region, from the first render to the result.
    const status = liveRegion();
    expect(status.textContent).toBe('Chargement du carnet');
    const retry = await screen.findByRole('button', { name: 'Réessayer' });
    expect(status.textContent).toBe('Impossible de charger tes plongées pour l’instant.');
    await user.click(retry);
    // The button is gone: the focus is on the content container, not lost on <body>.
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');

    expect(await screen.findByRole('table')).toBeTruthy();
    expect(liveRegion()).toBe(status);
    expect(status.textContent).toBe('127 plongées dans la sélection');
  });

  it('announces the forced error state with a retry button', () => {
    renderAt('/dives?state=error');
    expect(liveRegion().textContent).toBe('Impossible de charger tes plongées pour l’instant.');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });

  it('suggests removing the most restrictive filter when nothing matches', async () => {
    const user = userEvent.setup();
    renderAt('/dives?q=%C3%A9pave&region=bretagne&depthMin=40');
    await screen.findByRole('table');

    expect(
      first(screen.getAllByRole('heading', { name: 'Aucune plongée ne correspond' })),
    ).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(4);
    expect(screen.queryByRole('navigation', { name: 'Pages' })).toBeNull();

    await user.click(
      first(screen.getAllByRole('button', { name: 'Retirer « ≥ 40 m » · 3 résultats' })),
    );
    expect(search()).toBe('?q=%C3%A9pave&region=bretagne');
    expect(screen.getByText('3 plongées dans la sélection')).toBeTruthy();
  });

  it('says that export is coming soon', async () => {
    const user = userEvent.setup();
    renderAt('/dives');
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Exporter' }));
    expect(screen.getByText('Bientôt disponible')).toBeTruthy();
  });
});
