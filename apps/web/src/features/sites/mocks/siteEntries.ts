// Site entries for the tests of the map page: the mocked sites with a few dives each.
// Tests only: never imported by the application code.
import type { Site, SiteDive, SiteEntry } from '@/shared/model/site';
import { computeSiteStats } from '@/shared/sites/lib/siteStats';
import { mockSites } from '@/shared/sites/mocks/sites';

/** Dive counts of the list mockup (sites.jsx · SITES); the other sites have 1 dive. */
const DIVE_COUNTS: Readonly<Record<string, number>> = {
  s01: 8,
  s02: 3,
  s03: 2,
  s06: 6,
  s07: 4,
  s10: 5,
  s11: 11,
  s12: 2,
  s16: 3,
  s24: 0,
};

/** `count` dives, one a month back from April 2026, the deepest first. */
function divesOf(site: Site, count: number, offset: number): SiteDive[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${site.id}-d${index}`,
    number: 200 - offset * 12 - index,
    date: new Date(Date.UTC(2026, 3 - index, 28 - offset, 10)).toISOString(),
    depthMaxM: (site.depthMaxM ?? 20) - index,
    durationMin: 40,
    temperatureC: 15,
    entryType: null,
    diveCenter: null,
  }));
}

export function siteEntry(site: Site, count: number, offset = 0): SiteEntry {
  const dives = divesOf(site, count, offset);
  return { site, dives, stats: computeSiteStats(dives) };
}

export const mockSiteEntries: SiteEntry[] = mockSites.map((site, index) =>
  siteEntry(site, DIVE_COUNTS[site.id] ?? 1, index),
);
