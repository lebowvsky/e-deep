// The user's sites: those of the dive log (`GET /dives`) with their positions, under the local
// changes (`SitesOverlay`), each with its dives and statistics.
import type { DiveSiteRef, DiveSummary } from '@e-deep/shared';
import { avatarColorOf } from '@/shared/lib/avatarColor';
import { formatInitials, placeLabel } from '@/shared/lib/format';
import type { GeoPoint } from '@/shared/model/geo';
import type { Site, SiteDive, SiteEntry } from '@/shared/model/site';
import type { SitePositions } from '../api/sitePositionsApi';
import type { SitesOverlay } from '../repository/sitesRepository';
import { byLatest, computeSiteStats } from './siteStats';
import { deriveZone } from './zone';

export interface SiteCatalogueSources {
  /** The dive log, latest first (`GET /dives`). */
  dives: readonly DiveSummary[];
  positions: SitePositions;
  overlay: SitesOverlay;
}

/**
 * A site as the API knows it: name, « Calvi · Corse », position. Neither type, depths nor access
 * notes are served yet. A placed site was entered in full, a site without position was created
 * by its name from the dive form.
 */
function toSite(ref: DiveSiteRef, position: GeoPoint | null): Site {
  const region = placeLabel(ref.locality, ref.region);
  return {
    id: ref.id,
    name: ref.name,
    region,
    zone: deriveZone(position, region),
    type: null,
    depthMinM: null,
    depthMaxM: null,
    position,
    accessNotes: null,
    createdVia: position ? 'full' : 'quick',
    createdAt: null,
    updatedAt: null,
  };
}

function toSiteDive(summary: DiveSummary): SiteDive {
  return {
    id: summary.id,
    number: summary.number,
    date: summary.date,
    depthMaxM: summary.depthMaxM,
    durationMin: summary.durationMin,
    temperatureC: summary.temperatureC,
    // Detail fields, absent from the log: the usual entry and dive centre stay unknown.
    entryType: null,
    diveCenter: null,
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

export function buildSiteCatalogue({
  dives,
  positions,
  overlay,
}: SiteCatalogueSources): SiteEntry[] {
  const sites = new Map<string, Site>();
  const divesBySite = new Map<string, SiteDive[]>();

  for (const summary of dives) {
    // The log is latest first: the first summary of a site gives its current name.
    if (!sites.has(summary.site.id)) {
      sites.set(summary.site.id, toSite(summary.site, positions.get(summary.site.id) ?? null));
    }
    const siteId = overlay.mergedInto.get(summary.site.id) ?? summary.site.id;
    const siteDives = divesBySite.get(siteId);
    if (siteDives) siteDives.push(toSiteDive(summary));
    else divesBySite.set(siteId, [toSiteDive(summary)]);
  }
  for (const site of overlay.saved.values()) sites.set(site.id, site);

  return [...sites.values()]
    .filter((site) => !overlay.removed.has(site.id))
    .map((site) => {
      const siteDives = (divesBySite.get(site.id) ?? []).sort(byLatest);
      return { site, dives: siteDives, stats: computeSiteStats(siteDives) };
    })
    .sort(byDiveCount);
}
