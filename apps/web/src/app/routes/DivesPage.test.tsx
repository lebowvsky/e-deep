import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
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
    expect(screen.getByText('1–10')).toBeTruthy();
  });

  it('filters from a popover, announces the result and writes it in the URL', async () => {
    const user = userEvent.setup();
    renderAt('/dives?page=3');
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Région' }));
    const popover = screen.getByRole('dialog', { name: 'Filtre Région' });
    await user.click(within(popover).getByRole('button', { name: /Corse/ }));

    expect(search()).toBe('?region=corse');
    expect(screen.getByText('31 plongées dans la sélection').getAttribute('role')).toBe('status');
    expect(screen.getByRole('button', { name: 'Région, filtre actif' })).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Filtre Région' })).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Région, filtre actif' }),
    );

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
    const sites = screen.getAllByRole('link').filter((link) => link.closest('tbody'));
    expect(sites.length).toBeGreaterThan(0);
    expect(sites.every((link) => link.textContent === 'Épave du Liban')).toBe(true);
    expect(screen.getByText('Recherche « épave liban »')).toBeTruthy();
  });

  it('pages, sorts and changes the page size', async () => {
    const user = userEvent.setup();
    renderAt('/dives');
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Page suivante' }));
    expect(search()).toBe('?page=2');
    expect(screen.getByRole('button', { name: 'Page 2' }).getAttribute('aria-current')).toBe(
      'page',
    );

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Trier les plongées' }),
      'Plus profondes',
    );
    expect(search()).toBe('?sort=-depth');
    const depthHeader = screen.getByRole('columnheader', { name: /Prof\. max/ });
    expect(depthHeader.getAttribute('aria-sort')).toBe('descending');
    expect(screen.queryAllByRole('rowheader')).toHaveLength(0);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Plongées par page' }), '20');
    expect(search()).toBe('?sort=-depth&size=20');
  });

  it('says that export is coming soon', async () => {
    const user = userEvent.setup();
    renderAt('/dives');
    await screen.findByRole('table');

    await user.click(screen.getByRole('button', { name: 'Exporter' }));
    expect(screen.getByText('Bientôt disponible')).toBeTruthy();
  });
});
