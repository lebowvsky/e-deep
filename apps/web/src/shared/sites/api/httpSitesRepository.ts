// The `SitesRepository` port over the API (`/api/sites`, D31). The caches the writes change are
// refreshed by the commands (`useSiteCommands`), whatever the repository.
//
// A creation is never replayed as a `PUT` on `409 identifier-conflict` (unlike the dives): the id
// is drawn anew for every creation (`useSiteCommands`), so a conflict cannot be an earlier attempt
// of this one; it rejects like any other failure.
import type { SiteCreateRequest, SiteMergeRequest } from '@e-deep/shared';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import type { SitesRepository } from '../repository/sitesRepository';
import { isSiteListResponse, isSiteResponse, toSite, toSiteWriteRequest } from './siteContract';

const SITES_PATH = 'sites';
const sitePath = (id: string) => `${SITES_PATH}/${encodeURIComponent(id)}`;

const isSiteInUse = (error: unknown) =>
  error instanceof ApiError &&
  error.kind === 'http' &&
  error.status === 409 &&
  error.code === 'site-in-use';

export function createHttpSitesRepository(apiClient: ApiClient): SitesRepository {
  return {
    async list(options) {
      const { sites } = await apiClient.get(SITES_PATH, isSiteListResponse, options);
      return sites.map(toSite);
    },

    async create({ id, createdVia, ...draft }) {
      const body: SiteCreateRequest = { ...toSiteWriteRequest(id, draft, null), createdVia };
      return toSite(await apiClient.post(SITES_PATH, body, isSiteResponse));
    },

    async update(site, changes) {
      const body = toSiteWriteRequest(site.id, changes, site);
      return toSite(await apiClient.put(sitePath(site.id), body, isSiteResponse));
    },

    async merge(sourceId, targetId) {
      const body: SiteMergeRequest = { targetId };
      return toSite(await apiClient.post(`${sitePath(sourceId)}/merge`, body, isSiteResponse));
    },

    async remove(id) {
      try {
        await apiClient.delete(sitePath(id));
        return 'deleted';
      } catch (error) {
        if (isSiteInUse(error)) return 'in-use';
        throw error;
      }
    },
  };
}
