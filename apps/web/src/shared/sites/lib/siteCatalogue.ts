// The user's sites (`GET /api/sites`), each with its dives (`GET /dives`) and statistics.
import type { DiveSummary } from '@e-deep/shared';
import { avatarColorOf } from '@/shared/lib/avatarColor';
import { formatInitials } from '@/shared/lib/format';
import type { Site, SiteDive, SiteEntry } from '@/shared/model/site';
import { byLatest, computeSiteStats } from './siteStats';

export interface SiteCatalogueSources {
  sites: readonly Site[];
  /** The dive log, latest first (`GET /dives`). */
  dives: readonly DiveSummary[];
}

function toSiteDive(summary: DiveSummary): SiteDive {
  return {
    id: summary.id,
    number: summary.number,
    date: summary.date,
    depthMaxM: summary.depthMaxM,
    durationMin: summary.durationMin,
    temperatureC: summary.temperatureC,
    entryType: summary.entryType,
    diveCenter: summary.diveCenter,
    buddies: summary.buddies.map((buddy) => ({
      id: buddy.id,
      firstName: buddy.firstName,
      lastName: buddy.lastName,
      initials: formatInitials(buddy.firstName, buddy.lastName),
      color: avatarColorOf(buddy.id),
      isSelf: false,
    })),
  };
}

/** Most dived first, then by name. */
function byDiveCount(a: SiteEntry, b: SiteEntry): number {
  return (
    b.stats.diveCount - a.stats.diveCount ||
    a.site.name.localeCompare(b.site.name, 'fr', { sensitivity: 'base' })
  );
}

/**
 * Every site with its dives. A dive whose site is not among `sites` counts for none: it should
 * not happen (the API serves every live site of the log), save for the moment between the two
 * reads that follow a merge, when the log may still name the merged site. Shown, such a site
 * would come back on the map for that moment, with nothing to write it back (`PUT` → 404); its
 * dives stay in « Mes plongées ».
 */
export function buildSiteCatalogue({ sites, dives }: SiteCatalogueSources): SiteEntry[] {
  const divesBySite = new Map<string, SiteDive[]>();
  for (const summary of dives) {
    const siteDives = divesBySite.get(summary.site.id);
    if (siteDives) siteDives.push(toSiteDive(summary));
    else divesBySite.set(summary.site.id, [toSiteDive(summary)]);
  }

  return sites
    .map((site) => {
      const siteDives = (divesBySite.get(site.id) ?? []).sort(byLatest);
      return { site, dives: siteDives, stats: computeSiteStats(siteDives) };
    })
    .sort(byDiveCount);
}
