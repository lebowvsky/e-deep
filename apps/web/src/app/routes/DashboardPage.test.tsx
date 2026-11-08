import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { routes } from '@/app/routes';
import { dashboardResponse } from '@/features/dashboard/api/dashboardResponse.fixture';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import { ApiClientContext } from '@/shared/lib/apiClientContext';

const renderAt = (path: string, get: ApiClient['get'] = vi.fn()) =>
  render(
    <ApiClientContext value={{ get }}>
      <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
    </ApiClientContext>,
  );

describe('DashboardPage', () => {
  it('shows the skeleton while loading', async () => {
    renderAt('/dashboard?state=loading');
    const status = await screen.findByRole('status');
    expect(status.textContent).toBe('Chargement du tableau de bord');
    // The live region must stay outside the busy container, which could silence it.
    expect(status.closest('[aria-busy="true"]')).toBeNull();
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(document.title).toBe('Tableau de bord · E-Deep');
    expect(screen.getByRole('heading', { level: 1, name: 'Tableau de bord' })).toBeTruthy();
  });

  it('shows the onboarding state when there is no dive', async () => {
    renderAt('/dashboard?state=empty');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bienvenue à bord, Marine' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Aucun site marqué pour l’instant' })).toBeTruthy();
    expect(screen.getAllByText('Aucune donnée')).toHaveLength(4);
    const cta = screen.getByRole('link', { name: 'Enregistrer ma première plongée' });
    expect(cta.getAttribute('href')).toBe('/dives/new');
  });

  it('shows the nominal dashboard when data is ready', async () => {
    renderAt('/dashboard?state=ready');
    expect(await screen.findByRole('list', { name: 'Chiffres clés' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '6 palanquées régulières' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows the dashboard served by the API', async () => {
    renderAt('/dashboard', vi.fn().mockResolvedValue(dashboardResponse()));
    expect(await screen.findByRole('list', { name: 'Chiffres clés' })).toBeTruthy();
    expect(screen.getByText('Température au fond non renseignée')).toBeTruthy();
  });

  it('offers a retry when the API fails', async () => {
    const get = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('timeout', 'The API did not answer within 10000 ms.'))
      .mockResolvedValueOnce(dashboardResponse());
    renderAt('/dashboard', get);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Impossible de charger ton carnet pour l’instant.',
    );
    screen.getByRole('button', { name: 'Réessayer' }).click();
    expect(await screen.findByRole('list', { name: 'Chiffres clés' })).toBeTruthy();
  });
});
