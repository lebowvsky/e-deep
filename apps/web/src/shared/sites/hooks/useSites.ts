import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { dashboardQueryOptions } from '@/shared/dashboard/dashboardApi';
import { diveLogQueryOptions } from '@/shared/diveLog/diveLogApi';
import { useApiClient } from '@/shared/hooks/useApiClient';
import type { SiteEntry } from '@/shared/model/site';
import { toSitePositions } from '../api/sitePositionsApi';
import { buildSiteCatalogue } from '../lib/siteCatalogue';
import { useSitesOverlay } from './useSitesOverlay';

export type SitesState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  /** Most dived first; empty when the user has no site yet. */
  | { status: 'ready'; entries: SiteEntry[] };

export type SiteState =
  | { status: 'loading' }
  /** Unknown, deleted or merged away. */
  | { status: 'not-found' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; entry: SiteEntry };

/**
 * The user's sites with their statistics: the dive log (`GET /dives`, the cache entry of the dive
 * pages), the positions (`GET /dashboard`) and the local changes of the `SitesRepository`.
 */
export function useSites(): SitesState {
  const client = useApiClient();
  const log = useQuery(diveLogQueryOptions(client));
  const positions = useQuery({ ...dashboardQueryOptions(client), select: toSitePositions });
  const overlay = useSitesOverlay();
  const queries = [log, positions, overlay];

  const entries = useMemo(
    () =>
      log.data && positions.data && overlay.data
        ? buildSiteCatalogue({
            dives: log.data.dives,
            positions: positions.data,
            overlay: overlay.data,
          })
        : null,
    [log.data, positions.data, overlay.data],
  );
  const { refetch: refetchLog } = log;
  const { refetch: refetchPositions } = positions;
  const { refetch: refetchOverlay } = overlay;
  // Only the failed sources are asked again; the others stay in the cache.
  const retry = useCallback(() => {
    if (log.isError) void refetchLog();
    if (positions.isError) void refetchPositions();
    if (overlay.isError) void refetchOverlay();
  }, [
    log.isError,
    positions.isError,
    overlay.isError,
    refetchLog,
    refetchPositions,
    refetchOverlay,
  ]);

  if (entries) return { status: 'ready', entries };
  // A retry keeps the error flag until it settles: show the loading state meanwhile.
  if (queries.some((query) => query.isError) && !queries.some((query) => query.isFetching)) {
    return { status: 'error', retry };
  }
  return { status: 'loading' };
}

/** One site of the user, with its statistics and dives. */
export function useSite(id: string): SiteState {
  const state = useSites();
  if (state.status !== 'ready') return state;
  const entry = state.entries.find(({ site }) => site.id === id);
  return entry ? { status: 'ready', entry } : { status: 'not-found' };
}
