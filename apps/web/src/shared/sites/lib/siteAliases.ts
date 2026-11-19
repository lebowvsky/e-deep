// Sites merged on this device: their dives now belong to the target (`SitesOverlay.mergedInto`).

/** Merged site id → target id. Always one hop (`createMemorySitesRepository` keeps it so). */
export type SiteAliases = ReadonlyMap<string, string>;

export const NO_SITE_ALIASES: SiteAliases = new Map();

/** The site a dive belongs to now: the target of a merge, else its own. */
export function currentSiteId(aliases: SiteAliases, siteId: string): string {
  return aliases.get(siteId) ?? siteId;
}
