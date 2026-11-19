import type { DashboardSite, DiveLogResponse } from '@e-deep/shared';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import { fakeApiClient } from '@/test/fakeApiClient';
import { TestProviders } from '@/test/TestProviders';
import { MOCK_SITES } from '../mocks/sites';
import { createMemorySitesRepository, type SitesRepository } from '../repository/sitesRepository';
import { useSiteCommands } from './useSiteCommands';
import { useSite, useSites, type SitesState } from './useSites';

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
    },
    {
      id: 'd1',
      number: 1,
      date: '2026-04-04T10:00:00+02:00',
      utcOffsetMinutes: 120,
      site: { id: 'x1', name: 'Grotte aux Corbs', locality: null, region: null },
      depthMaxM: 22,
      durationMin: 45,
      temperatureC: 15,
      gasMix: 'AIR',
      notes: null,
      buddies: [],
    },
  ],
};

const DASHBOARD_SITES: DashboardSite[] = [
  {
    id: 's01',
    name: 'Pointe de la Revellata',
    region: 'Corse',
    latitude: 42.583,
    longitude: 8.725,
    diveCount: 1,
    maxDepthM: 42,
  },
  {
    id: 'x1',
    name: 'Grotte aux Corbs',
    region: null,
    latitude: null,
    longitude: null,
    diveCount: 1,
    maxDepthM: 22,
  },
];

/** `GET /dives` and `GET /dashboard` (only its sites are read). */
const answer = (path: string) =>
  Promise.resolve(path === 'dives' ? LOG : { sites: DASHBOARD_SITES });

function api() {
  return vi.fn().mockImplementation(answer);
}

function wrapper(get: ApiClient['get'], sitesRepository?: SitesRepository) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TestProviders
        client={fakeApiClient({ get })}
        {...(sitesRepository ? { sitesRepository } : {})}
      >
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
  it('loads the sites of the log with their positions', async () => {
    const { result } = renderHook(() => useSites(), { wrapper: wrapper(api()) });

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(idsOf(result.current)).toStrictEqual(['x1', 's01']);
    const state = result.current;
    if (state.status !== 'ready') return;
    expect(state.entries[1]?.site.position).toStrictEqual({ latitude: 42.583, longitude: 8.725 });
    expect(state.entries[0]?.site.position).toBeNull();
  });

  it('adds the sites written locally', async () => {
    const repository = createMemorySitesRepository();
    await repository.save(MOCK_SITES.bibliotheque);
    const { result } = renderHook(() => useSites(), { wrapper: wrapper(api(), repository) });

    await waitFor(() => expect(idsOf(result.current)).toContain('s02'));
  });

  it('fails when a source fails, and asks it again on retry', async () => {
    const get = vi
      .fn()
      .mockImplementation((path: string) =>
        path === 'dashboard' ? Promise.reject(new ApiError('network', 'down')) : answer(path),
      );
    const { result } = renderHook(() => useSites(), { wrapper: wrapper(get) });

    await waitFor(() => expect(result.current.status).toBe('error'));
    get.mockImplementation(answer);
    const state = result.current;
    if (state.status === 'error') act(() => state.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    // The log had loaded: only the dashboard is asked again.
    expect(get.mock.calls.filter(([path]) => path === 'dives')).toHaveLength(1);
  });
});

describe('useSite', () => {
  it('gives one site, or not-found', async () => {
    const { result } = renderHook(() => ({ found: useSite('s01'), missing: useSite('nope') }), {
      wrapper: wrapper(api()),
    });

    await waitFor(() => expect(result.current.found.status).toBe('ready'));
    expect(result.current.found).toMatchObject({
      entry: { site: { name: 'Pointe de la Revellata' }, stats: { diveCount: 1 } },
    });
    expect(result.current.missing).toStrictEqual({ status: 'not-found' });
  });
});

describe('useSiteCommands', () => {
  it('refreshes the sites after a write', async () => {
    const { result } = renderHook(() => ({ sites: useSites(), commands: useSiteCommands() }), {
      wrapper: wrapper(api()),
    });
    await waitFor(() => expect(result.current.sites.status).toBe('ready'));

    const created = await act(() =>
      result.current.commands.create(
        {
          name: 'Revellata — Grotte aux Corbs',
          region: 'Calvi · Corse',
          type: 'grotte',
          depthMinM: null,
          depthMaxM: null,
          position: null,
          accessNotes: null,
        },
        'quick',
      ),
    );

    expect(created).toMatchObject({ createdVia: 'quick', zone: 'mediterranee' });
    await waitFor(() => expect(idsOf(result.current.sites)).toContain(created.id));
  });
});
