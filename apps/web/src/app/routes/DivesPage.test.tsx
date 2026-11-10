import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DEFAULT_QUERY } from '@/features/dives/lib/query';
import { selectDives } from '@/features/dives/lib/selectDives';
import { mockDives } from '@/features/dives/mocks/dives';
import { ToastProvider } from '@/shared/ui/Toast';
import { DivesPage } from './DivesPage';

function Location() {
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
}

function renderAt(path: string) {
  return render(
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
    </ToastProvider>,
  );
}

const search = () => screen.getByTestId('search').textContent;

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
    expect(sites.every((link) => link.textContent === 'Épave du Liban')).toBe(true);
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

  it('says that export is coming soon', async () => {
    const user = userEvent.setup();
    renderAt('/dives');
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Exporter' }));
    expect(screen.getByText('Bientôt disponible')).toBeTruthy();
  });
});
