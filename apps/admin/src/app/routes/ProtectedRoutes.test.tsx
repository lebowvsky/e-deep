import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { createApiClient, type ApiClient } from '@/shared/lib/apiClient';
import { ApiClientContext } from '@/shared/lib/apiClientContext';
import { adminMe, createFakeApiClient, httpError, networkError } from '@/test/fakeApiClient';
import { createRoutes } from '../routes';

function renderAt(path: string, apiClient: ApiClient) {
  const router = createMemoryRouter(createRoutes({ apiClient }), { initialEntries: [path] });
  // The pages' own client (the health card): never reached by these tests.
  const pageClient = createApiClient({ baseUrl: 'http://api.test/api' });
  render(
    <ApiClientContext value={pageClient}>
      <RouterProvider router={router} />
    </ApiClientContext>,
  );
  return { router };
}

describe('protected routes', () => {
  it('send a visitor without a session to the login page, next kept', async () => {
    const { apiClient, ...api } = createFakeApiClient();
    api.get.mockRejectedValue(httpError(401));
    const { router } = renderAt('/somewhere?x=1', apiClient);

    expect(await screen.findByRole('heading', { name: 'Connexion au back-office' })).toBeDefined();
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe(
      '/login?next=%2Fsomewhere%3Fx%3D1',
    );
  });

  it('send a refused session to the forbidden page', async () => {
    const { apiClient, ...api } = createFakeApiClient();
    api.get.mockRejectedValue(httpError(403));
    renderAt('/', apiClient);

    expect(await screen.findByRole('heading', { name: 'Accès refusé' })).toBeDefined();
  });

  it('show the error page when the session cannot be checked', async () => {
    const { apiClient, ...api } = createFakeApiClient();
    api.get.mockRejectedValue(networkError());
    renderAt('/', apiClient);

    expect(await screen.findByRole('heading', { name: 'Une erreur est survenue' })).toBeDefined();
  });

  it('sign out, then show the login page', async () => {
    const { apiClient, ...api } = createFakeApiClient();
    api.get.mockResolvedValueOnce(adminMe()).mockRejectedValue(httpError(401));
    api.postNoContent.mockResolvedValue(undefined);
    const { router } = renderAt('/nowhere', apiClient);

    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(api.postNoContent.mock.calls[0]?.[0]).toBe('/admin/auth/logout');
  });

  it('stay on the page and say so when signing out fails', async () => {
    const { apiClient, ...api } = createFakeApiClient();
    api.get.mockResolvedValue(adminMe());
    api.postNoContent.mockRejectedValue(networkError());
    const { router } = renderAt('/nowhere', apiClient);

    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'La déconnexion a échoué. Réessayez.',
    );
    expect(router.state.location.pathname).toBe('/nowhere');
  });

  it('keep the layout and the message when signing out and the session check both fail', async () => {
    const { apiClient, ...api } = createFakeApiClient();
    // The session is checked once, then the API goes down.
    api.get.mockResolvedValueOnce(adminMe()).mockRejectedValue(networkError());
    api.postNoContent.mockRejectedValue(networkError());
    renderAt('/nowhere', apiClient);

    fireEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'La déconnexion a échoué. Réessayez.',
    );
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Une erreur est survenue' })).toBeNull();
    expect(api.get).toHaveBeenCalledOnce();
  });
});
