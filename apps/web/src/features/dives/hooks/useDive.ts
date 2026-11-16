import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { useApiClient } from '@/shared/hooks/useApiClient';
import {
  fetchDive,
  fetchDiveLog,
  isDiveNotFound,
  toDiveDetailView,
  toDiveLog,
  toSelfMember,
  type DiveLogOwner,
} from '../api/divesApi';
import { divesKeys } from '../api/queryKeys';
import { describeDiveInLog } from '../lib/diveInsights';
import type { DiveDetailState } from '../types';

const FORCED_STATES = ['loading', 'not-found', 'error'] as const;
type ForcedState = (typeof FORCED_STATES)[number];

function parseForcedState(value: string | null): ForcedState | null {
  return FORCED_STATES.find((state) => state === value) ?? null;
}

/**
 * The dive `id` of `owner`'s log, from `GET /dives/:id`.
 *
 * The whole log (`GET /dives`, the same cache entry as « Mes plongées », usually warm) is read
 * alongside, never blocking: it gives the header preview while the detail loads, then the
 * neighbours, the record, the site counters and the shared dives (`insights`). Without it, the page
 * still shows the dive.
 *
 * A 404 (or 400) is `not-found`, not an error: no retry, and nothing that echoes the id.
 *
 * Development only: `?state=loading|not-found|error` forces a state without calling the API.
 */
export function useDive(id: string, owner: DiveLogOwner): DiveDetailState {
  const client = useApiClient();
  const [searchParams] = useSearchParams();
  const forced = import.meta.env.DEV ? parseForcedState(searchParams.get('state')) : null;

  const detailQuery = useQuery({
    queryKey: divesKeys.detail(id),
    queryFn: ({ signal }) => fetchDive(client, id, { signal }),
    // No retry on a 404 / 400: the global policy (`shouldRetry`) never retries a 4xx.
    enabled: forced === null,
  });
  const logQuery = useQuery({
    queryKey: divesKeys.log(),
    queryFn: ({ signal }) => fetchDiveLog(client, { signal }),
    enabled: forced === null,
  });

  const self = useMemo(() => toSelfMember(owner), [owner]);
  const dive = useMemo(
    () => (detailQuery.data ? toDiveDetailView(detailQuery.data, self) : null),
    [detailQuery.data, self],
  );
  const log = useMemo(
    () => (logQuery.data ? toDiveLog(logQuery.data, owner) : null),
    [logQuery.data, owner],
  );
  const insights = useMemo(() => (log && dive ? describeDiveInLog(log, dive) : null), [log, dive]);
  const preview = useMemo(() => log?.find((entry) => entry.id === id) ?? null, [log, id]);

  const { refetch } = detailQuery;
  // The outcome of the new attempt replaces the error state; details stay out of the UI.
  const retry = useCallback(() => void refetch(), [refetch]);

  if (forced === 'error') return { status: 'error', retry };
  if (forced === 'not-found') return { status: 'not-found' };
  if (forced === 'loading') return { status: 'loading', preview: null };
  if (dive) return { status: 'ready', dive, insights };
  // A retry keeps the error flag until it settles: show the loading state meanwhile.
  if (detailQuery.isError && !detailQuery.isFetching) {
    return isDiveNotFound(detailQuery.error) ? { status: 'not-found' } : { status: 'error', retry };
  }
  return { status: 'loading', preview };
}
