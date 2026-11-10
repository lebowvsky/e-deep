import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { fetchDiveLog } from '../api/diveLogSource';
import { computeFacets, describeLog, filterDives, selectDives } from '../lib/selectDives';
import type { DivesQuery, DivesState, LoggedDive } from '../types';

const FORCED_STATES = ['loading', 'empty', 'error'] as const;
type ForcedState = (typeof FORCED_STATES)[number];

function parseForcedState(value: string | null): ForcedState | null {
  return FORCED_STATES.find((state) => state === value) ?? null;
}

type LoadState =
  { status: 'loading' } | { status: 'error' } | { status: 'loaded'; dives: LoggedDive[] };

/**
 * The dive log filtered, sorted and paginated by `query`. The summary covers the whole filtered
 * selection, not only the page.
 *
 * Development only: `?state=loading|empty|error` forces a state (comparison with the mockups); it
 * is ignored in production builds.
 */
export function useDives(query: DivesQuery, now?: Date): DivesState {
  const [searchParams] = useSearchParams();
  const forced = import.meta.env.DEV ? parseForcedState(searchParams.get('state')) : null;
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [today] = useState(() => now ?? new Date());

  useEffect(() => {
    if (forced) return;
    let cancelled = false;
    fetchDiveLog().then(
      (dives) => {
        if (!cancelled) setLoad({ status: 'loaded', dives });
      },
      () => {
        if (!cancelled) setLoad({ status: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [forced, attempt]);

  const retry = useCallback(() => {
    setLoad({ status: 'loading' });
    setAttempt((current) => current + 1);
  }, []);

  const dives = load.status === 'loaded' ? load.dives : null;
  const overview = useMemo(
    () => (dives ? { log: describeLog(dives), facets: computeFacets(dives) } : null),
    [dives],
  );
  const selection = useMemo(
    () => (dives ? selectDives(dives, query, today) : null),
    [dives, query, today],
  );
  const count = useCallback(
    (draft: DivesQuery) => (dives ? filterDives(dives, draft, today).length : 0),
    [dives, today],
  );

  if (forced === 'error') return { status: 'error', retry };
  if (forced) return { status: forced };
  if (load.status === 'error') return { status: 'error', retry };
  if (!dives || !overview || !selection) return { status: 'loading' };
  if (dives.length === 0) return { status: 'empty' };
  return { status: 'ready', ...overview, ...selection, count };
}
