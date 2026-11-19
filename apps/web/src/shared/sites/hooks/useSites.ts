import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { diveLogQueryOptions } from '@/shared/diveLog/diveLogApi';
import { useApiClient } from '@/shared/hooks/useApiClient';
import type { SiteEntry } from '@/shared/model/site';
import { sitesKeys } from '../api/queryKeys';
import { buildSiteCatalogue } from '../lib/siteCatalogue';
import { useSitesRepository } from '../repository/useSitesRepository';

export type SitesState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  /** Most dived first; empty when the user has no site yet. */
  | { status: 'ready'; entries: SiteEntry[] };

export interface UseSitesOptions {
  /** `false`: nothing is read (a state forced by `?state=`); the state stays `loading`. */
  enabled?: boolean;
}

/**
 * The user's sites with their statistics: the sites (`GET /api/sites`, through the
 * `SitesRepository`) and the dive log (`GET /dives`, the cache entry of the dive pages).
 */
export function useSites({ enabled = true }: UseSitesOptions = {}): SitesState {
  const client = useApiClient();
  const repository = useSitesRepository();
  const log = useQuery({ ...diveLogQueryOptions(client), enabled });
  const sites = useQuery({
    queryKey: sitesKeys.list(),
    queryFn: ({ signal }) => repository.list({ signal }),
    enabled,
  });
  const queries = [log, sites];

  const entries = useMemo(
    () =>
      log.data && sites.data
        ? buildSiteCatalogue({ sites: sites.data, dives: log.data.dives })
        : null,
    [log.data, sites.data],
  );
  const { refetch: refetchLog } = log;
  const { refetch: refetchSites } = sites;
  // Only the failed sources are asked again; the others stay in the cache.
  const retry = useCallback(() => {
    if (log.isError) void refetchLog();
    if (sites.isError) void refetchSites();
  }, [log.isError, sites.isError, refetchLog, refetchSites]);

  if (entries) return { status: 'ready', entries };
  // A retry keeps the error flag until it settles: show the loading state meanwhile.
  if (queries.some((query) => query.isError) && !queries.some((query) => query.isFetching)) {
    return { status: 'error', retry };
  }
  return { status: 'loading' };
}
