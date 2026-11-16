import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useApiClient } from '@/shared/hooks/useApiClient';
import { fetchDiveLog, toDiveLog, type DiveLogOwner } from '../api/divesApi';
import { divesKeys } from '../api/queryKeys';
import { computeFacets, describeLog, filterDives, selectDives } from '../lib/selectDives';
import type { DivesQuery, DivesState } from '../types';

const FORCED_STATES = ['loading', 'empty', 'error'] as const;
type ForcedState = (typeof FORCED_STATES)[number];

function parseForcedState(value: string | null): ForcedState | null {
  return FORCED_STATES.find((state) => state === value) ?? null;
}

/**
 * The dive log of `owner`, from `GET /dives`, filtered, sorted and paginated by `query`. The API
 * serves the whole log; the summary covers the whole filtered selection, not only the page.
 *
 * `owner` is the current user: the contract leaves them out of the dive teams, the view model
 * puts them back first (`isSelf`).
 *
 * Development only: `?state=loading|empty|error` forces a state (comparison with the mockups),
 * without calling the API; it is ignored in production builds.
 */
export function useDives(query: DivesQuery, now: Date, owner: DiveLogOwner): DivesState {
  const client = useApiClient();
  const [searchParams] = useSearchParams();
  const forced = import.meta.env.DEV ? parseForcedState(searchParams.get('state')) : null;
  const { data, isError, isFetching, refetch } = useQuery({
    queryKey: divesKeys.log(),
    queryFn: ({ signal }) => fetchDiveLog(client, { signal }),
    enabled: forced === null,
  });

  const dives = useMemo(() => (data ? toDiveLog(data, owner) : null), [data, owner]);
  const overview = useMemo(
    () => (dives ? { log: describeLog(dives), facets: computeFacets(dives) } : null),
    [dives],
  );
  const selection = useMemo(
    () => (dives ? selectDives(dives, query, now) : null),
    [dives, query, now],
  );
  const count = useCallback(
    (draft: DivesQuery) => (dives ? filterDives(dives, draft, now).length : 0),
    [dives, now],
  );
  // The outcome of the new attempt replaces the error state; details stay out of the UI.
  const retry = useCallback(() => void refetch(), [refetch]);

  if (forced === 'error') return { status: 'error', retry };
  if (forced) return { status: forced };
  if (dives && overview && selection) {
    if (dives.length === 0) return { status: 'empty' };
    return { status: 'ready', ...overview, ...selection, count };
  }
  // A retry keeps the error flag until it settles: show the loading state meanwhile.
  if (isError && !isFetching) return { status: 'error', retry };
  return { status: 'loading' };
}
