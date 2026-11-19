import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dashboardKeys } from '@/features/dashboard/api/queryKeys';
import { divesKeys } from '@/features/dives/api/queryKeys';
import { mockFilledDiveDetail } from '@/features/dives/mocks/diveDetailResponse';
import { mockDiveLogResponse } from '@/features/dives/mocks/diveLogResponse';
import { createFakeDiveApi } from '@/features/dives/mocks/fakeDiveApi';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import { ApiClientContext } from '@/shared/lib/apiClientContext';
import { isRecord } from '@/shared/lib/guards';
import { createMemorySitesRepository } from '@/shared/sites/repository/sitesRepository';
import { SitesRepositoryContext } from '@/shared/sites/repository/sitesRepositoryContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { fakeApiClient } from '@/test/fakeApiClient';
import { TestProviders } from '@/test/TestProviders';
import { DiveFormPage, type DiveFormPageProps } from './DiveFormPage';

const DETAIL_PREFIX = 'dives/';

/** Renders the page at `path` over `api` (the mocked log, each dive filled, writes kept). */
function renderAt(
  path: string,
  props: DiveFormPageProps = {},
  api: ApiClient = createFakeDiveApi().client,
) {
  const router = createMemoryRouter(
    [
      { path: '/dives/new', element: <DiveFormPage {...props} /> },
      { path: '/dives/:diveId/edit', element: <DiveFormPage {...props} /> },
      { path: '*', element: null },
    ],
    { initialEntries: [path] },
  );
  render(
    <TestProviders client={api}>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </TestProviders>,
  );
  return router;
}

/** The form itself (named by its h1), once the log and the source dive are loaded. */
const title = (name: string) => screen.findByRole('form', { name });
const siteField = () => screen.getByRole<HTMLInputElement>('combobox', { name: /^Site/ });
const field = (name: string | RegExp) => screen.getByLabelText<HTMLInputElement>(name);
const sectionLink = (name: RegExp) =>
  within(screen.getByRole('navigation', { name: 'Sections du formulaire' })).getByRole('link', {
    name,
  });

beforeEach(() => {
  localStorage.clear();
  // jsdom does not scroll.
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DiveFormPage — new dive', () => {
  it('opens on the next number and today, without suggestion past 48 h', async () => {
    renderAt('/dives/new');

    await title('Nouvelle plongée');
    expect(screen.getByText('Carnet · plongée #128')).toBeTruthy();
    expect(field(/^N° de plongée/).value).toBe('128');
    expect(screen.queryByRole('button', { name: 'Reprendre' })).toBeNull();
    expect(screen.queryByText(/Prérempli depuis/)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Enregistrer la plongée' })).toHaveLength(2);
    await waitFor(() => expect(document.title).toBe('Nouvelle plongée · E-Deep'));
  });

  it('suggests the latest dive under 48 h and takes its team, kit and conditions', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-04-09T09:00:00+02:00'));
    const user = userEvent.setup();
    renderAt('/dives/new');

    const resume = await screen.findByRole('button', { name: 'Reprendre' });
    expect(
      screen.getByText(/Reprendre la palanquée, l’équipement et les conditions de/),
    ).toBeTruthy();
    expect(field('Structure').value).toBe('');

    await user.click(resume);
    expect(field('Structure').value).toBe('Calvi Plongée');
    expect(field('Bloc').value).toBe('12');
    // The site and the times stay the diver's to enter.
    expect(siteField().value).toBe('');
    expect(screen.queryByRole('button', { name: 'Reprendre' })).toBeNull();
  });

  it('links the duration and the times both ways', async () => {
    renderAt('/dives/new');
    await title('Nouvelle plongée');

    fireEvent.change(field(/^Immersion/), { target: { value: '10:05' } });
    fireEvent.change(field(/^Sortie/), { target: { value: '10:49' } });
    expect(field(/^Durée/).value).toBe('44');

    fireEvent.change(field(/^Durée/), { target: { value: '50' } });
    expect(field(/^Sortie/).value).toBe('10:55');
  });

  it('saves with Ctrl + Entrée: blocked, it lists the fields to fix and focuses the first', async () => {
    const user = userEvent.setup();
    renderAt('/dives/new');
    await title('Nouvelle plongée');

    await user.click(field(/^N° de plongée/));
    await user.keyboard('{Control>}{Enter}{/Control}');

    const summary = await screen.findByRole('alert');
    expect(within(summary).getByText('5 champs à corriger')).toBeTruthy();
    const links = within(summary).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      'Site',
      'Immersion',
      'Sortie',
      'Durée',
      'Profondeur max',
    ]);
    expect(document.activeElement).toBe(siteField());

    await user.click(within(summary).getByRole('link', { name: 'Profondeur max' }));
    expect(document.activeElement).toBe(field(/^Profondeur max/));
  });

  it('keeps the form when the log changes under it (no suggestion appearing midway)', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity, staleTime: Infinity } },
    });
    const router = createMemoryRouter([{ path: '/dives/new', element: <DiveFormPage /> }], {
      initialEntries: ['/dives/new'],
    });
    render(
      <ApiClientContext value={createFakeDiveApi().client}>
        <SitesRepositoryContext value={createMemorySitesRepository()}>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </QueryClientProvider>
        </SitesRepositoryContext>
      </ApiClientContext>,
    );
    await title('Nouvelle plongée');
    fireEvent.change(field('Notes'), { target: { value: 'Mérou sous la voûte' } });

    // A dive of the last 48 h lands in the log (a save, a refetch): it would offer « Reprendre ».
    const [latest] = mockDiveLogResponse.dives;
    if (!latest) throw new Error('Empty log');
    const recent = {
      ...latest,
      id: 'recent',
      date: new Date(Date.now() - 3_600_000).toISOString(),
    };
    await act(async () => {
      queryClient.setQueryData(divesKeys.log(), {
        dives: [recent, ...mockDiveLogResponse.dives],
      });
      // The query cache notifies its observers in a timeout.
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    expect(screen.queryByRole('button', { name: 'Reprendre' })).toBeNull();
    expect(screen.queryByText('Brouillon restauré')).toBeNull();
    expect(field('Notes').value).toBe('Mérou sous la voûte');
  });

  it('shows the state of each section in the summary', async () => {
    renderAt('/dives/new');
    await title('Nouvelle plongée');

    expect(sectionLink(/^L’essentiel, partielle, il manque Site$/)).toBeTruthy();
    expect(sectionLink(/^Palanquée, vide$/)).toBeTruthy();

    fireEvent.change(field('Notes'), { target: { value: 'Mérou sous la voûte' } });
    expect(sectionLink(/^Notes & observations, partielle, il manque Espèces$/)).toBeTruthy();
    expect(sectionLink(/^Notes & observations/).getAttribute('href')).toBe('#dive-section-notes');
  });
});

describe('DiveFormPage — sites', () => {
  it('starts on the site of `?site=` (« Nouvelle plongée ici »)', async () => {
    renderAt('/dives/new?site=s11');

    await title('Nouvelle plongée');
    expect(siteField().value).toBe('La Gabinière');
  });

  it('ignores a `?site=` that is none of my sites', async () => {
    renderAt('/dives/new?site=unknown');

    await title('Nouvelle plongée');
    expect(siteField().value).toBe('');
  });

  it('sends a site created on the fly as new, with its own id, so that the API creates it', async () => {
    const user = userEvent.setup();
    const api = createFakeDiveApi();
    const router = renderAt('/dives/new', {}, api.client);
    await title('Nouvelle plongée');

    await user.type(siteField(), 'Grotte aux Corbs');
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: 'Créer et sélectionner' }));
    await waitFor(() => expect(document.activeElement).toBe(field(/^Date/)));
    expect(screen.getByText('Nouveau site : il sera créé à l’enregistrement.')).toBeTruthy();
    // The site is one of mine now: its region shows at the end of the field.
    expect(siteField().parentElement?.textContent).toContain('Calvi · Corse');

    fireEvent.change(field(/^Immersion/), { target: { value: '10:05' } });
    fireEvent.change(field(/^Sortie/), { target: { value: '10:49' } });
    fireEvent.change(field(/^Profondeur max/), { target: { value: '22' } });
    await user.click(
      screen.getAllByRole('button', { name: 'Enregistrer la plongée' })[0] ?? document.body,
    );
    await waitFor(() => expect(router.state.location.pathname).not.toBe('/dives/new'));

    const [post] = api.requests.filter(({ method }) => method === 'POST');
    const body: unknown = post?.body;
    expect(body).toMatchObject({ site: { name: 'Grotte aux Corbs', isNew: true } });
    const siteId = isRecord(body) && isRecord(body.site) ? body.site.id : undefined;
    expect(siteId).toEqual(expect.any(String));
    expect(body).toMatchObject({ event: { siteId } });
  });
});

describe('DiveFormPage — duplicate', () => {
  it('takes the site, team, kit and conditions of the source, never its times', async () => {
    renderAt('/dives/new?from=d127');

    await title('Nouvelle plongée');
    expect(await screen.findByText(/Prérempli depuis/)).toBeTruthy();
    expect(screen.getByText(/palanquée, équipement et conditions repris/)).toBeTruthy();
    expect(siteField().value).toBe('Pointe de la Revellata');
    expect(field(/^N° de plongée/).value).toBe('128');
    expect(field('Structure').value).toBe('Calvi Plongée');
    for (const name of [/^Immersion/, /^Sortie/, /^Durée/, /^Profondeur max/]) {
      expect(field(name).value).toBe('');
    }
    expect(screen.getByRole('button', { name: 'Retirer Lucas Bernard' })).toBeTruthy();
    expect(sectionLink(/^Équipement & gaz, partielle, il manque Pression fin$/)).toBeTruthy();
  });

  it('starts again from a blank dive with « Repartir de zéro »', async () => {
    const user = userEvent.setup();
    renderAt('/dives/new?from=d127');

    await user.click(await screen.findByRole('button', { name: 'Repartir de zéro' }));
    expect(siteField().value).toBe('');
    expect(field('Structure').value).toBe('');
    expect(screen.queryByText(/Prérempli depuis/)).toBeNull();
  });
});

describe('DiveFormPage — edit', () => {
  it('shows the dive values, without banner, and saves back to the detail with a toast', async () => {
    const user = userEvent.setup();
    const router = renderAt('/dives/d127/edit');

    await title('Modifier la plongée #127');
    expect(screen.getByText('Carnet · plongée #127')).toBeTruthy();
    expect(screen.queryByText(/Prérempli depuis/)).toBeNull();
    expect(field(/^Immersion/).value).toBe('10:30');
    expect(field(/^Sortie/).value).toBe('11:08');
    expect(field('Pression fin').value).toBe('60');
    const saves = screen.getAllByRole('button', { name: 'Enregistrer les modifications' });
    expect(saves).toHaveLength(2);

    // Unsaved changes do not hold back the redirect of a successful save.
    await user.clear(field('Pression fin'));
    await user.type(field('Pression fin'), '50');
    await user.click(saves[0] ?? document.body);

    await waitFor(() => expect(router.state.location.pathname).toBe('/dives/d127'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Plongée #127 enregistrée');
  });

  it('replaces the dive with a PUT carrying the updatedAt it was read with (D-25)', async () => {
    const user = userEvent.setup();
    const api = createFakeDiveApi();
    const router = renderAt('/dives/d127/edit', {}, api.client);

    await title('Modifier la plongée #127');
    await user.click(
      screen.getAllByRole('button', { name: 'Enregistrer les modifications' })[0] ?? document.body,
    );
    await waitFor(() => expect(router.state.location.pathname).toBe('/dives/d127'));

    const writes = api.requests.filter(({ method }) => method !== 'GET');
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({
      method: 'PUT',
      path: 'dives/d127',
      body: {
        event: { id: 'd127', siteId: 's01' },
        baseUpdatedAt: mockFilledDiveDetail('d127').updatedAt,
      },
    });
    // The log is read again once saved: the API numbers the dives.
    const writeIndex = api.requests.findIndex(({ method }) => method === 'PUT');
    expect(api.requests.slice(writeIndex).some(({ path }) => path === 'dives')).toBe(true);
  });

  it('marks the dashboard stale once saved: its stats and last dive include the dive', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    queryClient.setQueryData(dashboardKeys.all, { cached: true });
    const router = createMemoryRouter(
      [
        { path: '/dives/:diveId/edit', element: <DiveFormPage /> },
        { path: '*', element: null },
      ],
      { initialEntries: ['/dives/d127/edit'] },
    );
    render(
      <ApiClientContext value={createFakeDiveApi().client}>
        <SitesRepositoryContext value={createMemorySitesRepository()}>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </QueryClientProvider>
        </SitesRepositoryContext>
      </ApiClientContext>,
    );

    await title('Modifier la plongée #127');
    expect(queryClient.getQueryState(dashboardKeys.all)?.isInvalidated).toBe(false);
    await user.click(
      screen.getAllByRole('button', { name: 'Enregistrer les modifications' })[0] ?? document.body,
    );

    await waitFor(() => expect(router.state.location.pathname).toBe('/dives/d127'));
    expect(queryClient.getQueryState(dashboardKeys.all)?.isInvalidated).toBe(true);
  });

  it('announces the number the dive got once moved to another date', async () => {
    const router = renderAt('/dives/d127/edit');

    await title('Modifier la plongée #127');
    fireEvent.change(field(/^Date/), { target: { value: '2026-04-06' } });
    fireEvent.change(field(/^Immersion/), { target: { value: '08:00' } });
    // Before #125 (06/04 10:00 +02:00) whatever the time zone of the device running the test.
    expect(field(/^N° de plongée/).value).toBe('125');
    await userEvent
      .setup()
      .click(
        screen.getAllByRole('button', { name: 'Enregistrer les modifications' })[0] ??
          document.body,
      );

    await waitFor(() => expect(router.state.location.pathname).toBe('/dives/d127'));
    expect(screen.getByRole('status').textContent).toBe('Plongée #125 enregistrée');
  });

  it('locks the shared event when the diver cannot edit it', async () => {
    renderAt('/dives/d127/edit', { canEditEvent: false });

    await title('Modifier la plongée #127');
    expect(siteField().readOnly).toBe(true);
    expect(field(/^Date/).readOnly).toBe(true);
    expect(
      screen.getAllByText(
        'Partagé avec la palanquée — modifiable par la personne qui a créé la plongée',
      ).length,
    ).toBeGreaterThan(0);
    expect(field(/^Profondeur max/).readOnly).toBe(false);
  });

  it('shows ✕, the title and the number in the phone top bar', async () => {
    renderAt('/dives/d127/edit');

    await title('Modifier la plongée #127');
    const close = screen.getAllByRole('link', { name: 'Annuler' })[0] ?? document.body;
    expect(close.getAttribute('href')).toBe('/dives/d127');
    const topBar = within(close.parentElement ?? document.body);
    expect(topBar.getByText('Modifier la plongée')).toBeTruthy();
    expect(topBar.getByText('#127')).toBeTruthy();
  });

  it('says when the dive does not exist', async () => {
    const get = vi
      .fn()
      .mockImplementation((path: string) =>
        path.startsWith(DETAIL_PREFIX)
          ? Promise.reject(new ApiError('http', 'HTTP 404', { status: 404 }))
          : Promise.resolve(mockDiveLogResponse),
      );
    const router = createMemoryRouter(
      [{ path: '/dives/:diveId/edit', element: <DiveFormPage /> }],
      {
        initialEntries: ['/dives/unknown/edit'],
      },
    );
    render(
      <TestProviders client={fakeApiClient({ get })}>
        <RouterProvider router={router} />
      </TestProviders>,
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: /n’existe pas ou a été supprimée/ }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Retour à mes plongées' })).toBeTruthy();
  });
});

describe('DiveFormPage — save refused by the API', () => {
  /** The edit of #127 over an API whose `PUT` fails with `error`. */
  async function saveEditRejectedWith(error: ApiError) {
    const user = userEvent.setup();
    const { client } = createFakeDiveApi();
    const router = renderAt(
      '/dives/d127/edit',
      {},
      { ...client, put: () => Promise.reject(error) },
    );
    await title('Modifier la plongée #127');
    await user.click(
      screen.getAllByRole('button', { name: 'Enregistrer les modifications' })[0] ?? document.body,
    );
    return router;
  }

  const httpError = (
    status: number,
    body: { code?: string; fieldErrors?: Record<string, string[]> },
  ) => new ApiError('http', `HTTP ${status}`, { status, ...body });

  it('shows the field errors of a 400 on the fields of the form, and stays', async () => {
    const router = await saveEditRejectedWith(
      httpError(400, {
        code: 'validation-failed',
        fieldErrors: { 'participation.maxDepthM': ['max'], 'observations.0.label': ['length'] },
      }),
    );

    const summary = await screen.findByRole('alert');
    expect(
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Profondeur max', 'Espèces']);
    expect(screen.getByText('Indique une profondeur entre 1 et 100 m.')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/dives/d127/edit');
  });

  it('asks to choose the site again on a 422 invalid-reference', async () => {
    await saveEditRejectedWith(httpError(422, { code: 'invalid-reference' }));

    const summary = await screen.findByRole('alert');
    expect(within(summary).getByRole('link', { name: 'Site' })).toBeTruthy();
    expect(
      screen.getByText('Ce site n’est plus dans ton carnet. Choisis-le à nouveau ou crée-le.'),
    ).toBeTruthy();
  });

  it.each([
    ['a 409 identifier-conflict', httpError(409, { code: 'identifier-conflict' })],
    ['a 404 (dive deleted meanwhile)', httpError(404, {})],
    [
      'a 400 without a field of the form',
      httpError(400, {
        code: 'validation-failed',
        fieldErrors: { 'event.id': ['matches-route'] },
      }),
    ],
  ])('keeps the values and says the save did not go through on %s', async (_label, error) => {
    // An unexpected failure is reported, not swallowed.
    const report = vi.fn();
    vi.stubGlobal('reportError', report);
    const router = await saveEditRejectedWith(error);

    expect(await screen.findByText(/L’enregistrement n’a pas abouti/)).toBeTruthy();
    expect(report).toHaveBeenCalledWith(error);
    expect(field('Pression fin').value).toBe('60');
    expect(router.state.location.pathname).toBe('/dives/d127/edit');
  });
});
