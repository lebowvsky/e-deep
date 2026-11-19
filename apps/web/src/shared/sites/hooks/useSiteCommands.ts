import { useQueryClient } from '@tanstack/react-query';
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

/**
 * The writes on the sites, through the injected repository; each one refreshes the sites. Ids are
 * UUID v4 (`crypto.randomUUID()`), as for the dives.
 */
export function useSiteCommands(): SiteCommands {
  const repository = useSitesRepository();
  const queryClient = useQueryClient();

  async function refreshed<T>(write: Promise<T>): Promise<T> {
    const result = await write;
    await queryClient.invalidateQueries({ queryKey: sitesKeys.overlay() });
    return result;
  }

  return {
    create: (draft, createdVia) =>
      refreshed(
        createSite(repository, draft, { id: crypto.randomUUID(), createdVia, now: new Date() }),
      ),
    update: (site, draft) => refreshed(updateSite(repository, site, draft, new Date())),
    merge: (source, target) => refreshed(mergeSites(repository, source, target, new Date())),
    remove: (entry) => refreshed(deleteSite(repository, entry)),
  };
}
