import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { diveLogQueryOptions } from '@/shared/diveLog/diveLogApi';
import { useApiClient } from '@/shared/hooks/useApiClient';
import { useSites } from '@/shared/sites/hooks/useSites';
import { toDiveLog, type DiveLogOwner } from '../api/divesApi';
import type { LoggedDive } from '../types';
import { buildDiveFormSources, type DiveFormSources } from './sources';

export type DiveFormSourcesState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; log: LoggedDive[]; sources: DiveFormSources };

/**
 * The lists of the form (sites, divers met, next number…), from the user's sites (`useSites`:
 * `GET /api/sites` and the log) and the log (`GET /dives`, the cache entry of « Mes plongées »).
 * The form waits for them: the next number and the duplicate warning need the whole log.
 */
export function useDiveFormSources(owner: DiveLogOwner): DiveFormSourcesState {
  const client = useApiClient();
  const sites = useSites();
  // The same cache entry as `useSites`: it settles with it, its errors are reported by it.
  const { data } = useQuery(diveLogQueryOptions(client));
  const log = useMemo(() => (data ? toDiveLog(data, owner) : null), [data, owner]);
  const entries = sites.status === 'ready' ? sites.entries : null;
  const sources = useMemo(
    () => (log && entries ? buildDiveFormSources(log, entries) : null),
    [log, entries],
  );

  if (log && sources) return { status: 'ready', log, sources };
  if (sites.status === 'error') return sites;
  return { status: 'loading' };
}
