import type { DiveLogResponse } from '@e-deep/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DASHBOARD_QUERY_KEY } from '@/shared/dashboard/dashboardApi';
import { DIVE_LOG_QUERY_KEY } from '@/shared/diveLog/diveLogApi';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import { ApiClientContext } from '@/shared/lib/apiClientContext';
import { fakeApiClient } from '@/test/fakeApiClient';
import { TestProviders } from '@/test/TestProviders';
import { sitesKeys } from '../api/queryKeys';
import { createMemorySitesRepository } from '../mocks/memorySitesRepository';
import { MOCK_SITES } from '../mocks/sites';
import type { SitesRepository } from '../repository/sitesRepository';
import { SitesRepositoryContext } from '../repository/sitesRepositoryContext';
import { useSiteCommands } from './useSiteCommands';
import { useSites, type SitesState } from './useSites';

const LOG: DiveLogResponse = {
  dives: [
    {
      id: 'd2',
      number: 2,
      date: '2026-04-08T10:30:00+02:00',
      utcOffsetMinutes: 120,
      site: { id: 's01', name: 'Pointe de la Revellata', locality: 'Calvi', region: 'Corse' },
      depthMaxM: 42,
      durationMin: 38,
      temperatureC: 14,
      gasMix: 'AIR',
      notes: null,
      buddies: [],
      entryType: 'BOAT',
      diveCenter: 'Calvi Plongée',
    },
  ],
};

const SITES = [MOCK_SITES.revellata, MOCK_SITES.grotteAuxCorbs];

/** `GET /dives` only: the sites come from the repository, never from `GET /dashboard`. */
const answer = (path: string) =>
  path === 'dives' ? Promise.resolve(LOG) : Promise.reject(new Error(`Unexpected GET ${path}`));

function wrapper(get: ApiClient['get'], sitesRepository: SitesRepository) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TestProviders client={fakeApiClient({ get })} sitesRepository={sitesRepository}>
        {children}
      </TestProviders>
    );
  };
}

function idsOf(state: SitesState): string[] {
  if (state.status !== 'ready') throw new Error(`Expected the ready state, got ${state.status}`);
  return state.entries.map(({ site }) => site.id);
}

describe('useSites', () => {
  it('reads the sites and the log: positions from the sites, figures from the log', async () => {
    const get = vi.fn().mockImplementation(answer);
    const { result } = renderHook(() => useSites(), {
      wrapper: wrapper(get, createMemorySitesRepository({ sites: SITES })),
    });

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(idsOf(result.current)).toStrictEqual(['s01', 's24']);
    const state = result.current;
    if (state.status !== 'ready') return;
    const [revellata, grotte] = state.entries;
    expect(revellata?.site.position).toStrictEqual({ latitude: 42.583, longitude: 8.725 });
    expect(revellata?.stats).toMatchObject({
      diveCount: 1,
      usualEntryType: 'BOAT',
      usualDiveCenter: 'Calvi Plongée',
    });
    expect(grotte?.site).toMatchObject({ position: null, createdVia: 'quick' });
    expect(get).toHaveBeenCalledOnce();
    expect(get.mock.calls[0]?.[0]).toBe('dives');
  });

  it('reads nothing while disabled', () => {
    const get = vi.fn().mockImplementation(answer);
    const repository = createMemorySitesRepository({ sites: SITES });
    const list = vi.spyOn(repository, 'list');
    const { result } = renderHook(() => useSites({ enabled: false }), {
      wrapper: wrapper(get, repository),
    });

    expect(result.current.status).toBe('loading');
    expect(get).not.toHaveBeenCalled();
    expect(list).not.toHaveBeenCalled();
  });

  it.each([
    ['the sites', 'sites'],
    ['the log', 'dives'],
  ] as const)('fails when %s fail, and asks only them again on retry', async (_label, failing) => {
    const get = vi.fn().mockImplementation(answer);
    const repository = createMemorySitesRepository({ sites: SITES });
    const list = vi.spyOn(repository, 'list');
    const down = () => Promise.reject(new ApiError('network', 'down'));
    if (failing === 'sites') list.mockImplementationOnce(down);
    else get.mockImplementationOnce(down);
    const { result } = renderHook(() => useSites(), { wrapper: wrapper(get, repository) });

    await waitFor(() => expect(result.current.status).toBe('error'));
    const state = result.current;
    if (state.status === 'error') act(() => state.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    // The source that had loaded stays in the cache.
    expect(list).toHaveBeenCalledTimes(failing === 'sites' ? 2 : 1);
    expect(get).toHaveBeenCalledTimes(failing === 'dives' ? 2 : 1);
  });
});

describe('useSiteCommands', () => {
  function renderCommands() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(DASHBOARD_QUERY_KEY, { cached: true });
    queryClient.setQueryData(DIVE_LOG_QUERY_KEY, LOG);
    queryClient.setQueryData(sitesKeys.list(), []);
    const repository = createMemorySitesRepository({ sites: SITES, log: { dives: LOG.dives } });
    const { result } = renderHook(() => useSiteCommands(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ApiClientContext value={fakeApiClient({})}>
          <SitesRepositoryContext value={repository}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </SitesRepositoryContext>
        </ApiClientContext>
      ),
    });
    const isStale = (queryKey: readonly string[]) =>
      queryClient.getQueryState(queryKey)?.isInvalidated;
    return { commands: result.current, isStale };
  }

  it('refreshes only the sites after a creation: a new site has no dive', async () => {
    const { commands, isStale } = renderCommands();

    const created = await act(() =>
      commands.create(
        {
          name: 'Le Sec du Phare',
          region: 'Calvi · Corse',
          type: 'sec',
          depthMinM: null,
          depthMaxM: null,
          position: null,
          accessNotes: null,
        },
        'quick',
      ),
    );

    expect(created).toMatchObject({ createdVia: 'quick', zone: 'mediterranee' });
    expect(isStale(sitesKeys.list())).toBe(true);
    expect(isStale(DIVE_LOG_QUERY_KEY)).toBe(false);
    expect(isStale(DASHBOARD_QUERY_KEY)).toBe(false);
  });

  it('refreshes the sites, the dives and the dashboard after an edit or a merge', async () => {
    const { commands, isStale } = renderCommands();

    await act(() => commands.merge(MOCK_SITES.grotteAuxCorbs, MOCK_SITES.revellata));

    expect(isStale(sitesKeys.list())).toBe(true);
    expect(isStale(DIVE_LOG_QUERY_KEY)).toBe(true);
    expect(isStale(DASHBOARD_QUERY_KEY)).toBe(true);
  });
});
