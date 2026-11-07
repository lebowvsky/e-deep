import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { mockPayload } from '../../mocks/dashboard';
import { DashboardReady } from './DashboardReady';

const NOW = new Date('2025-09-22T15:00:00Z'); // 14 days after the last dive

function renderReady() {
  return render(
    <MemoryRouter>
      <DashboardReady data={mockPayload} now={NOW} />
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

  it('selects a site from the map markers', async () => {
    const user = userEvent.setup();
    renderReady();
    const markers = screen.getByRole('list', { name: 'Sites de plongée' });
    const revellata = within(markers).getByRole('button', { name: /Pointe de la Revellata/ });
    const portCros = within(markers).getByRole('button', { name: /Port-Cros/ });
    expect(revellata.getAttribute('aria-pressed')).toBe('true');

    await user.click(portCros);
    expect(portCros.getAttribute('aria-pressed')).toBe('true');
    expect(revellata.getAttribute('aria-pressed')).toBe('false');
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
