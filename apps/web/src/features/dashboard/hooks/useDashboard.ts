import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useApiClient } from '@/shared/hooks/useApiClient';
import { fetchDashboard, toDashboardState } from '../api/dashboardApi';
import { dashboardKeys } from '../api/queryKeys';
import { mockStates } from '../mocks/dashboard';
import type { DashboardState } from '../types';

type ForcedState = keyof typeof mockStates;

function parseForcedState(value: string | null): ForcedState | null {
  return value === 'loading' || value === 'empty' || value === 'ready' ? value : null;
}

/**
 * Dashboard of the current diver, from `GET /dashboard`.
 *
 * Development only: `?state=loading|empty|ready` forces a mocked state (comparison with the
 * mockups), without calling the API; it is ignored in production builds.
 */
export function useDashboard(): DashboardState {
  const client = useApiClient();
  const [searchParams] = useSearchParams();
  const forced = import.meta.env.DEV ? parseForcedState(searchParams.get('state')) : null;
  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: dashboardKeys.all,
    queryFn: ({ signal }) => fetchDashboard(client, { signal }),
    enabled: forced === null,
  });

  const state = useMemo(() => (data ? toDashboardState(data) : null), [data]);
  // The outcome of the new attempt replaces the error state; details stay out of the UI.
  const retry = useCallback(() => void refetch(), [refetch]);

  if (forced) return mockStates[forced];
  if (state) return state;
  // A retry keeps the error flag until it settles: show the loading state meanwhile.
  if (isError && !isFetching) return { status: 'error', retry };
  return { status: 'loading' };
}
