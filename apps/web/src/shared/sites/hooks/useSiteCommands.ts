import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { DASHBOARD_QUERY_KEY } from '@/shared/dashboard/dashboardApi';
import { DIVES_QUERY_KEY } from '@/shared/diveLog/diveLogApi';
import type { Site, SiteDraft, SiteEntry, SiteOrigin } from '@/shared/model/site';
import { sitesKeys } from '../api/queryKeys';
import {
  createSite,
  deleteSite,
  mergeSites,
  updateSite,
  type DeleteSiteResult,
} from '../lib/siteCommands';
import { useSitesRepository } from '../repository/useSitesRepository';

export interface SiteCommands {
  create: (draft: SiteDraft, createdVia: SiteOrigin) => Promise<Site>;
  update: (site: Site, draft: SiteDraft) => Promise<Site>;
  /** `source` goes into `target`; the merged target is returned. */
  merge: (source: Site, target: Site) => Promise<Site>;
  remove: (entry: SiteEntry) => Promise<DeleteSiteResult>;
}

/** A new site has no dive yet: only the sites change. */
const CREATION_KEYS = [sitesKeys.all];
/**
 * A site renamed, completed, merged or deleted changes the dives that name it (log and details)
 * and the dashboard (sites, last dive).
 */
const WRITE_KEYS = [sitesKeys.all, DIVES_QUERY_KEY, DASHBOARD_QUERY_KEY];

/**
 * The writes on the sites, through the injected repository; each one refreshes what it changes,
 * awaited so that the page it leads to reads it. Ids are UUID v4 (`crypto.randomUUID()`), as for
 * the dives.
 */
export function useSiteCommands(): SiteCommands {
  const repository = useSitesRepository();
  const queryClient = useQueryClient();

  // Stable while the repository and the cache are: safe in effects and memoised children.
  return useMemo<SiteCommands>(() => {
    async function refreshed<T>(write: Promise<T>, keys: readonly (readonly string[])[]) {
      const result = await write;
      // A failed refetch does not reject (`invalidateQueries`): the write is done whatever happens.
      await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      return result;
    }
    return {
      create: (draft, createdVia) =>
        refreshed(
          createSite(repository, draft, { id: crypto.randomUUID(), createdVia }),
          CREATION_KEYS,
        ),
      update: (site, draft) => refreshed(updateSite(repository, site, draft), WRITE_KEYS),
      merge: (source, target) => refreshed(mergeSites(repository, source, target), WRITE_KEYS),
      remove: (entry) => refreshed(deleteSite(repository, entry), WRITE_KEYS),
    };
  }, [repository, queryClient]);
}
