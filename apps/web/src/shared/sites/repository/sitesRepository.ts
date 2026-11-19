// Where the writes on the sites go. The API has no site endpoint yet: the sites are read from the
// dive log, and what the user changes is kept beside it, as an overlay. The memory repository
// loses it on reload (debt, `docs/sites/plan.md`); an HTTP repository will replace it, behind the
// same port.
import type { Site } from '@/shared/model/site';

/** The local changes, laid over the sites read from the API. */
export interface SitesOverlay {
  /** Sites written here (created, edited, completed by a merge): they replace the API's version. */
  saved: ReadonlyMap<string, Site>;
  /** Sites deleted, or merged into another one. */
  removed: ReadonlySet<string>;
  /** Merged sites, source id → target id: the dives read from the log follow it. */
  mergedInto: ReadonlyMap<string, string>;
}

export interface SitesRepository {
  read(): Promise<SitesOverlay>;
  /** Creates or replaces the site. */
  save(site: Site): Promise<Site>;
  /**
   * Replaces the target with `target` (already completed), removes the source and sends its
   * dives, and those of the sites merged into it before, to the target.
   */
  merge(sourceId: string, target: Site): Promise<Site>;
  remove(id: string): Promise<void>;
}

export const EMPTY_SITES_OVERLAY: SitesOverlay = {
  saved: new Map(),
  removed: new Set(),
  mergedInto: new Map(),
};

/** In memory: one per app session (`AppProviders`), one per test. Every read gets a snapshot. */
export function createMemorySitesRepository(
  initial: SitesOverlay = EMPTY_SITES_OVERLAY,
): SitesRepository {
  let overlay = initial;

  return {
    read: () => Promise.resolve(overlay),

    save(site) {
      const saved = new Map(overlay.saved).set(site.id, site);
      const removed = new Set(overlay.removed);
      removed.delete(site.id);
      overlay = { ...overlay, saved, removed };
      return Promise.resolve(site);
    },

    merge(sourceId, target) {
      const saved = new Map(overlay.saved).set(target.id, target);
      saved.delete(sourceId);
      const mergedInto = new Map<string, string>();
      // Sites merged into the source earlier now lead to the target too: one hop, always.
      for (const [from, to] of overlay.mergedInto) {
        mergedInto.set(from, to === sourceId ? target.id : to);
      }
      mergedInto.set(sourceId, target.id);
      overlay = { saved, removed: new Set(overlay.removed).add(sourceId), mergedInto };
      return Promise.resolve(target);
    },

    remove(id) {
      const saved = new Map(overlay.saved);
      saved.delete(id);
      overlay = { ...overlay, saved, removed: new Set(overlay.removed).add(id) };
      return Promise.resolve();
    },
  };
}
