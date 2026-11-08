import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApiClient } from '@/shared/hooks/useApiClient';
import { fetchDashboard, toDashboardState } from '../api/dashboardApi';
import { mockStates } from '../mocks/dashboard';
import type { DashboardState } from '../types';

type ForcedState = keyof typeof mockStates;

function parseForcedState(value: string | null): ForcedState | null {
  return value === 'loading' || value === 'empty' || value === 'ready' ? value : null;
}

type LoadState = Exclude<DashboardState, { status: 'error' }> | { status: 'error' };

/**
 * Dashboard of the current diver, from `GET /dashboard`.
 *
 * Development only: `?state=loading|empty|ready` forces a mocked state (comparison with the
 * mockups); it is ignored in production builds.
 */
export function useDashboard(): DashboardState {
  const client = useApiClient();
  const [searchParams] = useSearchParams();
  const forced = import.meta.env.DEV ? parseForcedState(searchParams.get('state')) : null;
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (forced) return;
    const controller = new AbortController();
    fetchDashboard(client, { signal: controller.signal }).then(
      (response) => setState(toDashboardState(response)),
      () => {
        // Cancelled on unmount or by a newer attempt: not a failure. Details stay out of the UI.
        if (!controller.signal.aborted) setState({ status: 'error' });
      },
    );
    return () => controller.abort();
  }, [client, forced, attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  if (forced) return mockStates[forced];
  return state.status === 'error' ? { status: 'error', retry } : state;
}
