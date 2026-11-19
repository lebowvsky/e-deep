import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { formatUtcOffset } from '@/shared/lib/format';
import type { MapViewProps } from '@/shared/ui/MapView';
import { mockPayload } from '../../mocks/dashboard';
import type { DashboardPayload } from '../../types';
import { DashboardReady } from './DashboardReady';

// No WebGL in jsdom: the map is a group of marker buttons, with its preview.
vi.mock('@/shared/ui/MapView', () => ({
  MapView: ({ label, sites, selectedId, onSelect, viewport, readOnly, popover }: MapViewProps) => (
    <div
      role="group"
      aria-label={label}
      data-read-only={readOnly}
      data-framed={viewport.points.length}
    >
      {sites.map((site) => (
        <button
          key={site.id}
          type="button"
          aria-label={site.name}
          aria-pressed={site.id === selectedId}
          onClick={() => onSelect?.(site.id)}
        />
      ))}
      {popover}
    </div>
  ),
}));

const map = () => screen.getByRole('group', { name: 'Carte de tes sites de plongée' });

const NOW = new Date('2025-09-22T15:00:00Z'); // 14 days after the last dive

function renderReady(data: DashboardPayload = mockPayload) {
  return render(
    <MemoryRouter>
      <DashboardReady data={data} now={NOW} />
    </MemoryRouter>,
  );
}

describe('DashboardReady', () => {
  it('greets the diver with the days since the last dive', () => {
    renderReady();
    expect(screen.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeTruthy();
    expect(screen.getByText('14 jours depuis ta dernière plongée.')).toBeTruthy();
  });

  it('exposes KPI values and units together to screen readers', () => {
    renderReady();
    const kpis = screen.getByRole('list', { name: 'Chiffres clés' });
    expect(within(kpis).getAllByRole('listitem')).toHaveLength(4);
    expect(within(kpis).getByText('127 plongées')).toBeTruthy();
    expect(within(kpis).getByText('84 heures 23 minutes sous l’eau')).toBeTruthy();
    expect(within(kpis).getByText('42 mètres')).toBeTruthy();
  });

  it('gives the chart a data table and highlights the busiest month', () => {
    renderReady();
    const table = screen.getByRole('table', { name: /plongées par mois/i });
    expect(within(table).getAllByRole('row')).toHaveLength(13);
    expect(within(table).getByRole('rowheader', { name: 'sept' })).toBeTruthy();
    expect(screen.getByText('pic · sept.')).toBeTruthy();
  });

  it('shows a read-only map framing every placed site', () => {
    renderReady();
    expect(map().dataset.readOnly).toBe('true');
    expect(map().dataset.framed).toBe(String(mockPayload.sites.length));
  });

  it('selects a site from the map markers, its preview links to the site page', async () => {
    const user = userEvent.setup();
    renderReady();
    const revellata = within(map()).getByRole('button', { name: /Pointe de la Revellata/ });
    const portCros = within(map()).getByRole('button', { name: /Port-Cros/ });
    expect(revellata.getAttribute('aria-pressed')).toBe('true');
    expect(within(map()).getByRole('link', { name: 'Pointe de la Revellata' })).toBeTruthy();

    await user.click(portCros);
    expect(portCros.getAttribute('aria-pressed')).toBe('true');
    expect(revellata.getAttribute('aria-pressed')).toBe('false');
    const preview = within(map()).getByRole('link', { name: /Port-Cros/ });
    expect(preview.getAttribute('href')).toBe('/sites/s2');
  });

  it('switches the (visual) map period', async () => {
    const user = userEvent.setup();
    renderReady();
    const periods = screen.getByRole('group', { name: 'Période' });
    const threeMonths = within(periods).getByRole('button', { name: '3M' });
    expect(threeMonths.getAttribute('aria-pressed')).toBe('true');
    await user.click(within(periods).getByRole('button', { name: '1A' }));
    expect(threeMonths.getAttribute('aria-pressed')).toBe('false');
  });

  it('links every action to a route', () => {
    renderReady();
    const href = (name: RegExp | string) =>
      screen.getAllByRole('link', { name })[0]?.getAttribute('href');
    expect(href('Nouvelle plongée')).toBe('/dives/new');
    expect(href('Voir le détail de la dernière plongée')).toBe('/dives/d1');
    expect(href('Voir tous les binômes')).toBe('/buddies');
    expect(href('Rechercher')).toBe('/search');
  });
});

describe('DashboardReady, sites created by their name (D-23)', () => {
  const lastDive = mockPayload.lastDive;
  if (!lastDive) throw new Error('The mocked payload has a last dive');
  /** A new site without region nor position, last dived; no main region yet. */
  const withNameOnlySite: DashboardPayload = {
    ...mockPayload,
    stats: { ...mockPayload.stats, mainArea: null },
    lastDive: { ...lastDive, site: { id: 's-new', name: 'Le Sec', region: null } },
    sites: [
      ...mockPayload.sites,
      { id: 's-new', name: 'Le Sec', region: null, position: null, diveCount: 1, maxDepthM: 18 },
    ],
  };

  it('gives no marker to a site without position', () => {
    renderReady(withNameOnlySite);
    expect(within(map()).getAllByRole('button')).toHaveLength(mockPayload.sites.length);
    expect(within(map()).queryByRole('button', { name: /Le Sec/ })).toBeNull();
    // No marker is pressed and no preview: the last dive's site is not on the map.
    expect(within(map()).queryByRole('button', { pressed: true })).toBeNull();
    expect(within(map()).queryByRole('link')).toBeNull();
  });

  it('does without the main region and the region of the last dive', () => {
    renderReady(withNameOnlySite);
    expect(screen.getByRole('heading', { level: 2, name: 'Mes sites' })).toBeTruthy();
    // The time zone alone, no « region · » before it.
    expect(screen.getByText(/^UTC/).textContent).toBe(formatUtcOffset(NOW));
    expect(screen.queryByText(/principalement/)).toBeNull();
    // The six regions of the mocked sites, the new site not counted.
    expect(screen.getAllByText(/^6 régions/).length).toBeGreaterThan(0);
    const card = screen.getByRole('article', { name: 'Le Sec' });
    // The date alone under the site name, no « region · » before it.
    const date = card.querySelector('time');
    expect(date?.parentElement?.textContent).toBe(date?.textContent);
  });
});
