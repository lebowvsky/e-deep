import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { dashboardQueryOptions } from '@/shared/dashboard/dashboardApi';
import { useApiClient } from '@/shared/hooks/useApiClient';
import { toDashboardState } from '../api/dashboardApi';
import type { DashboardState } from '../types';

const FORCED_STATES = ['loading', 'empty', 'ready'] as const;
type ForcedState = (typeof FORCED_STATES)[number];

function parseForcedState(value: string | null): ForcedState | null {
  return FORCED_STATES.find((state) => state === value) ?? null;
}

/**
 * The mocked state, loaded on demand. `import.meta.env.DEV` is false in production: the loader and
 * the mocks it imports are dropped from the bundle.
 */
const loadForcedState = import.meta.env.DEV
  ? async (state: ForcedState): Promise<DashboardState> =>
      (await import('../mocks/dashboard')).mockStates[state]
  : null;

/**
 * Dashboard of the current diver, from `GET /dashboard`.
 *
 * Development only: `?state=loading|empty|ready` forces a mocked state (comparison with the
 * mockups), without calling the API; it is ignored in production builds.
 */
export function useDashboard(): DashboardState {
  const client = useApiClient();
  const [searchParams] = useSearchParams();
  const forced = loadForcedState ? parseForcedState(searchParams.get('state')) : null;
  const { data, isError, isFetching, refetch } = useQuery({
    ...dashboardQueryOptions(client),
    enabled: forced === null,
  });
  const { data: forcedState } = useQuery({
    queryKey: ['dev', 'dashboard-state', forced],
    queryFn: () =>
      forced === null || loadForcedState === null
        ? Promise.reject(new Error('No forced dashboard state.'))
        : loadForcedState(forced),
    enabled: forced !== null,
    staleTime: Infinity,
  });

  const state = useMemo(() => (data ? toDashboardState(data) : null), [data]);
  // The outcome of the new attempt replaces the error state; details stay out of the UI.
  const retry = useCallback(() => void refetch(), [refetch]);

  // While the mocks load, the forced page shows the loading state.
  if (forced) return forcedState ?? { status: 'loading' };
  if (state) return state;
  // A retry keeps the error flag until it settles: show the loading state meanwhile.
  if (isError && !isFetching) return { status: 'error', retry };
  return { status: 'loading' };
}
