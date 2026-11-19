import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { mockDiveDetail } from '@/features/dives/mocks/diveDetailResponse';
import { mockDiveLogResponse } from '@/features/dives/mocks/diveLogResponse';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import type { MapViewProps } from '@/shared/ui/MapView';
import { ToastProvider } from '@/shared/ui/Toast';
import { TestProviders } from '@/test/TestProviders';
import { DiveDetailPage } from './DiveDetailPage';
import { DivesPage } from './DivesPage';
import { fakeApiClient } from '@/test/fakeApiClient';

// No WebGL in jsdom: the map is a labelled picture.
vi.mock('@/shared/ui/MapView', () => ({
  MapView: ({ label }: MapViewProps) => <div role="img" aria-label={label} />,
}));

const DETAIL_PREFIX = 'dives/';

/** Answers like the API: the log on `dives`, the detail of any mocked dive on `dives/:id`. */
function apiLike(
  detail: (id: string) => Promise<unknown> = (id) => Promise.resolve(mockDiveDetail(id)),
) {
  return vi
    .fn()
    .mockImplementation((path: string) =>
      path.startsWith(DETAIL_PREFIX)
        ? detail(path.slice(DETAIL_PREFIX.length))
        : Promise.resolve(mockDiveLogResponse),
    );
}

function Location() {
  const { pathname, search } = useLocation();
  return <output data-testid="location">{`${pathname}${search}`}</output>;
}

function renderAt(path: string, get: ApiClient['get'] = apiLike()) {
  render(
    <TestProviders client={fakeApiClient({ get })}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/dives" element={<DivesPage />} />
            <Route path="/dives/:diveId" element={<DiveDetailPage />} />
          </Routes>
          <Location />
        </MemoryRouter>
      </ToastProvider>
    </TestProviders>,
  );
  return { get };
}

const location = () => screen.getByTestId('location').textContent;

/** The page live region (the toasts have their own). */
const liveRegion = () => {
  const region = screen.getAllByRole('status').find((element) => element.tagName === 'P');
  if (!region) throw new Error('No live region');
  return region;
};

const backLink = () => screen.getByRole('link', { name: 'Mes plongées' });

describe('DiveDetailPage', () => {
  it('shows the dive: site as h1, headline measures, run, team and log insights', async () => {
    renderAt('/dives/d100');

    const detail = mockDiveDetail('d100');
    // The loading state has a hidden h1 of its own: wait for the site.
    await screen.findByRole('heading', { level: 1, name: detail.site.name });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    await waitFor(() => expect(document.title).toBe('Plongée #100 · E-Deep'));
    expect(liveRegion().textContent).toBe(`Plongée n° 100, ${detail.site.name}`);

    const measures = screen.getByRole('list', { name: 'Mesures' });
    expect(within(measures).getByText(`${detail.depthMaxM} mètres`)).toBeTruthy();
    expect(within(measures).getByText(`${detail.durationMin} minutes`)).toBeTruthy();

    for (const name of ['Déroulé de la plongée', 'Notes & observations', 'Site']) {
      expect(screen.getByRole('region', { name: new RegExp(name) })).toBeTruthy();
    }
    const team = screen.getByRole('region', { name: /Palanquée/ });
    expect(within(team).getByText(/· toi/)).toBeTruthy();
    expect(within(team).getAllByText(/plongées? ensemble/).length).toBe(detail.buddies.length);

    // Neighbours from the log, with their full spoken name (buttons and phone tiles).
    const previous = await screen.findAllByRole('link', { name: /^Plongée précédente : #99, / });
    expect(previous[0]?.getAttribute('href')).toBe('/dives/d99');
    expect(screen.getAllByRole('link', { name: /^Plongée suivante : #101, / }).length).toBe(2);
  });

  it('links to the edit form and to a duplicate of the dive', async () => {
    renderAt('/dives/d100');

    const edit = await screen.findByRole('link', { name: 'Modifier ma plongée' });
    expect(edit.getAttribute('href')).toBe('/dives/d100/edit');
    const duplicate = screen.getByRole('link', { name: 'Dupliquer la plongée' });
    expect(duplicate.getAttribute('href')).toBe('/dives/new?from=d100');
  });

  it('disables the next dive on the latest one', async () => {
    renderAt('/dives/d127');
    await screen.findAllByRole('link', { name: /^Plongée précédente/ });
    expect(screen.queryByRole('link', { name: /^Plongée suivante/ })).toBeNull();
    // Disabled links (buttons and phone tile): announced as dimmed links, out of the tab order.
    const ends = screen.getAllByRole('link', { name: 'Dernière plongée' });
    expect(ends).toHaveLength(2);
    for (const end of ends) {
      expect(end.getAttribute('aria-disabled')).toBe('true');
      expect(end.hasAttribute('href')).toBe(false);
    }
  });

  it('goes back to the list with the selection the user left, even after paging', async () => {
    const user = userEvent.setup();
    renderAt('/dives?region=corse&sort=-depth');

    const table = await screen.findByRole('table');
    const [firstDive] = within(table).getAllByRole('link');
    if (!firstDive) throw new Error('No dive link');
    await user.click(firstDive);
    await screen.findByRole('region', { name: /Déroulé/ });
    expect(location()).toMatch(/^\/dives\/d\d+$/);
    expect(backLink().getAttribute('href')).toBe('/dives?region=corse&sort=-depth');

    // Leafing through keeps the way back.
    const [previous] = await screen.findAllByRole('link', { name: /^Plongée précédente/ });
    if (!previous) throw new Error('No previous dive');
    await user.click(previous);
    await waitFor(() =>
      expect(backLink().getAttribute('href')).toBe('/dives?region=corse&sort=-depth'),
    );

    await user.click(backLink());
    expect(location()).toBe('/dives?region=corse&sort=-depth');
  });

  it('goes back to /dives on a direct access', async () => {
    renderAt('/dives/d100');
    await screen.findByRole('region', { name: /Déroulé/ });
    expect(backLink().getAttribute('href')).toBe('/dives');
  });

  it('says the dive does not exist on a 404, without echoing the id', async () => {
    renderAt(
      '/dives/unknown-dive-id',
      apiLike(() => Promise.reject(new ApiError('http', 'HTTP 404', { status: 404 }))),
    );

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'Cette plongée n’existe pas ou a été supprimée.',
    });
    expect(heading).toBeTruthy();
    expect(liveRegion().textContent).toBe('Cette plongée n’existe pas ou a été supprimée.');
    expect(screen.getByRole('link', { name: 'Retour à mes plongées' }).getAttribute('href')).toBe(
      '/dives',
    );
    // The test's own location output aside, the id is nowhere on the page.
    const pageText = document.body.textContent.replace(location() ?? '', '');
    expect(pageText).not.toContain('unknown-dive-id');
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
  });

  it('announces a loading error and keeps the focus in the page on retry', async () => {
    const user = userEvent.setup();
    const detail = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('network', 'The API is unreachable.'))
      .mockImplementation((id: string) => Promise.resolve(mockDiveDetail(id)));
    renderAt('/dives/d100', apiLike(detail));

    const status = liveRegion();
    expect(status.textContent).toBe('Chargement de la plongée');
    const retry = await screen.findByRole('button', { name: 'Réessayer' });
    expect(status.textContent).toBe('Impossible de charger cette plongée pour l’instant.');
    await user.click(retry);
    const focused = document.activeElement;
    expect(focused?.getAttribute('tabindex')).toBe('-1');

    const run = await screen.findByRole('region', { name: /Déroulé/ });
    expect(focused?.contains(run)).toBe(true);
    expect(document.activeElement).toBe(focused);
    expect(liveRegion()).toBe(status);
    expect(detail).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['loading', 'Chargement de la plongée'],
    ['not-found', 'Cette plongée n’existe pas ou a été supprimée.'],
    ['error', 'Impossible de charger cette plongée pour l’instant.'],
  ])('forces the %s state with ?state= without calling the API', (state, announcement) => {
    const { get } = renderAt(`/dives/d100?state=${state}`);
    expect(liveRegion().textContent).toBe(announcement);
    expect(get).not.toHaveBeenCalled();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    if (state === 'loading') expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    if (state === 'error') expect(screen.getByRole('button', { name: 'Réessayer' })).toBeTruthy();
  });
});
