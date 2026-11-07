import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { mockStates } from '../mocks/dashboard';
import type { DashboardState } from '../types';

type ForcedState = keyof typeof mockStates;

/** Fake latency in dev, so the loading state is seen. */
const DEV_DELAY_MS = 400;

function parseForcedState(value: string | null): ForcedState | null {
  return value === 'loading' || value === 'empty' || value === 'ready' ? value : null;
}

/**
 * Dashboard data. Mock source for now (`?state=loading|empty|ready` forces a state); the signature
 * stays the same when the API is plugged in.
 */
export function useDashboard(): DashboardState {
  const [searchParams] = useSearchParams();
  const forced = parseForcedState(searchParams.get('state'));
  const [loaded, setLoaded] = useState(!import.meta.env.DEV);

  useEffect(() => {
    if (forced || loaded) return;
    const timer = setTimeout(() => setLoaded(true), DEV_DELAY_MS);
    return () => clearTimeout(timer);
  }, [forced, loaded]);

  if (forced) return mockStates[forced];
  return loaded ? mockStates.ready : mockStates.loading;
}
