// The list of the map page: search, filters, sort, and the counters of the header and chips.
import type { SiteEntry, SiteType, SiteZone } from '@/shared/model/site';
import { SITE_ZONES } from '@/shared/model/site';
import { searchSites } from '@/shared/sites/lib/searchSites';

export const SITE_SORTS = ['dives', 'name', 'last', 'depth'] as const;
export type SiteSort = (typeof SITE_SORTS)[number];

export const SITE_SORT_LABELS: Record<SiteSort, string> = {
  dives: 'Plus plongés',
  name: 'Nom',
  last: 'Dernière plongée',
  depth: 'Profondeur max',
};

export const ZONE_LABELS: Record<SiteZone, string> = {
  mediterranee: 'Méditerranée',
  atlantique: 'Atlantique',
  manche: 'Manche',
  autre: 'Autre',
};

export interface SiteListQuery {
  q: string;
  /** `null`: every type. */
  type: SiteType | null;
  /** Region group (`regionGroupOf`), `null`: every region. */
  region: string | null;
  /** « À compléter »: the sites without position only. */
  toComplete: boolean;
  sort: SiteSort;
}

export const DEFAULT_SITE_LIST_QUERY: SiteListQuery = {
  q: '',
  type: null,
  region: null,
  toComplete: false,
  sort: 'dives',
};

/** « Calvi · Corse » → « Corse »: the broadest part of the region, for the filter and the count. */
export function regionGroupOf(region: string | null): string | null {
  if (region === null) return null;
  const parts = region
    .split('·')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  return parts.at(-1) ?? null;
}

/** Region groups of the sites, by name. */
export function regionGroups(entries: readonly SiteEntry[]): string[] {
  const groups = new Set<string>();
  for (const { site } of entries) {
    const group = regionGroupOf(site.region);
    if (group !== null) groups.add(group);
  }
  return [...groups].sort((a, b) => a.localeCompare(b, 'fr'));
}

const byName = (a: SiteEntry, b: SiteEntry) =>
  a.site.name.localeCompare(b.site.name, 'fr', { sensitivity: 'base' });

const lastDate = ({ stats }: SiteEntry) =>
  stats.lastDive ? Date.parse(stats.lastDive.date) : Number.NEGATIVE_INFINITY;
const maxDepth = ({ stats }: SiteEntry) => stats.maxDepth?.depthM ?? Number.NEGATIVE_INFINITY;

const COMPARATORS: Record<SiteSort, (a: SiteEntry, b: SiteEntry) => number> = {
  dives: (a, b) => b.stats.diveCount - a.stats.diveCount || byName(a, b),
  name: byName,
  last: (a, b) => lastDate(b) - lastDate(a) || byName(a, b),
  depth: (a, b) => maxDepth(b) - maxDepth(a) || byName(a, b),
};

/**
 * The sites the list shows. With a search, the best matches come first (`searchSites`); without,
 * the chosen sort applies.
 */
export function selectSites(entries: readonly SiteEntry[], query: SiteListQuery): SiteEntry[] {
  const kept = entries.filter(
    ({ site }) =>
      (query.type === null || site.type === query.type) &&
      (query.region === null || regionGroupOf(site.region) === query.region) &&
      (!query.toComplete || site.position === null),
  );
  if (query.q.trim() !== '') {
    const searchable = kept.map((entry) => ({
      entry,
      name: entry.site.name,
      diveCount: entry.stats.diveCount,
    }));
    return searchSites(searchable, query.q).map(({ entry }) => entry);
  }
  return [...kept].sort(COMPARATORS[query.sort]);
}

/** Sites without position: the « À compléter » counter. */
export function toCompleteCount(entries: readonly SiteEntry[]): number {
  return entries.filter(({ site }) => site.position === null).length;
}

/** Zones that have placed sites, in the order of `SITE_ZONES`, with their counts. */
export function zoneCounts(entries: readonly SiteEntry[]): { zone: SiteZone; count: number }[] {
  return SITE_ZONES.map((zone) => ({
    zone,
    count: entries.filter(({ site }) => site.zone === zone).length,
  })).filter(({ count }) => count > 0);
}
