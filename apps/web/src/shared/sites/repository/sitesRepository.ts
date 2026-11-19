// Where the sites are read and written: the API (`createHttpSitesRepository`) in the app, a
// repository in memory (`@/shared/sites/mocks/memorySitesRepository`) in the tests. The rules of
// the writes (names, merge, deletion) are the API's; the commands (`siteCommands.ts`) prepare
// them.
import type { RequestOptions } from '@/shared/lib/apiClient';
import type { Site, SiteDraft, SiteOrigin } from '@/shared/model/site';

/** A site to create: its id is drawn by the client (D22), its origin is fixed for good. */
export interface NewSite extends SiteDraft {
  id: string;
  createdVia: SiteOrigin;
}

/** `in-use`: dives still use the site; merging it is the way out (RG-37). */
export type RemoveSiteOutcome = 'deleted' | 'in-use';

export interface SitesRepository {
  /** The user's live sites. */
  list(options?: RequestOptions): Promise<Site[]>;
  create(site: NewSite): Promise<Site>;
  /** Replaces `site` with `changes` (full replacement): the site as saved. */
  update(site: Site, changes: SiteDraft): Promise<Site>;
  /**
   * Sends every dive of `sourceId` to `targetId`, completes the empty fields of the target with
   * those of the source, deletes the source (RG-35). The completed target.
   */
  merge(sourceId: string, targetId: string): Promise<Site>;
  remove(id: string): Promise<RemoveSiteOutcome>;
}
