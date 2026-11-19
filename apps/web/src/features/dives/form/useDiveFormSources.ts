import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { diveLogQueryOptions } from '@/shared/diveLog/diveLogApi';
import { useApiClient } from '@/shared/hooks/useApiClient';
import { useSitesOverlay } from '@/shared/sites/hooks/useSitesOverlay';
import { toDiveLog, type DiveLogOwner } from '../api/divesApi';
import type { LoggedDive } from '../types';
import { buildDiveFormSources, type DiveFormSources } from './sources';

export type DiveFormSourcesState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; log: LoggedDive[]; sources: DiveFormSources };

/**
 * The lists of the form (sites, divers met, next number…), from the log (`GET /dives`, the cache
 * entry of « Mes plongées ») and the local changes on the sites (sites created on the fly). The
 * form waits for it: the next number and the duplicate warning need the whole log.
 */
export function useDiveFormSources(owner: DiveLogOwner): DiveFormSourcesState {
  const client = useApiClient();
  const { data, isError, isFetching, refetch } = useQuery(diveLogQueryOptions(client));
  // Local and in memory: it does not fail, and settles at once.
  const { data: overlay } = useSitesOverlay();
  const log = useMemo(() => (data ? toDiveLog(data, owner) : null), [data, owner]);
  const sources = useMemo(
    () => (log && overlay ? buildDiveFormSources(log, overlay) : null),
    [log, overlay],
  );

  if (log && sources) return { status: 'ready', log, sources };
  if (isError && !isFetching) return { status: 'error', retry: () => void refetch() };
  return { status: 'loading' };
}
