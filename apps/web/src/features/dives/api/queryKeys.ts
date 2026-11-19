import { DIVE_LOG_QUERY_KEY, DIVES_QUERY_KEY } from '@/shared/diveLog/diveLogApi';

/** Query keys of the dive log: `all` invalidates everything the feature caches. */
export const divesKeys = {
  all: DIVES_QUERY_KEY,
  /** Shared with the sites (`@/shared/diveLog`), under `all`. */
  log: () => DIVE_LOG_QUERY_KEY,
  detail: (id: string) => [...divesKeys.all, 'detail', id] as const,
};
