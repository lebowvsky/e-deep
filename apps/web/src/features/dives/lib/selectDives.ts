// Client-side selection of the dive log: filter → sort → summary → page.
// Pure functions: the future paginated API will do the same work server side.
import type { GasMix } from '@e-deep/shared';
import { activeFilterKeys, withoutFilter } from './query';
import {
  REGION_KEYS,
  type DiveLogOverview,
  type DivesFacets,
  type DivesQuery,
  type DivesSelection,
  type DivesSort,
  type DivesSummary,
  type GasFamily,
  type LoggedDive,
  type MonthTotal,
  type Relaxation,
} from '../types';

const GAS_FAMILY: Record<GasMix, GasFamily> = {
  AIR: 'air',
  NITROX32: 'nitrox',
  NITROX36: 'nitrox',
  OTHER: 'other',
};

export function gasFamily(gasMix: GasMix): GasFamily {
  return GAS_FAMILY[gasMix];
}

/** "2026-04-08T10:30:00+02:00" → "2026-04" (the dive's own calendar month). */
export function yearMonthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** Lower case, without accents: « Épave » and « epave » match. */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function searchableText(dive: LoggedDive): string {
  return normalizeText(
    [
      dive.site.name,
      dive.site.place,
      ...dive.team.map((member) => `${member.firstName} ${member.lastName}`),
      dive.notes ?? '',
    ].join(' '),
  );
}

/** "YYYY-MM-DD" of the day one year before `now` (local calendar). */
function twelveMonthsBefore(now: Date): string {
  const year = now.getFullYear() - 1;
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Predicate of the query filters (search, period, regions, depth, gas, dive team). */
export function matchesQuery(query: DivesQuery, now: Date): (dive: LoggedDive) => boolean {
  const terms = normalizeText(query.q).split(/\s+/).filter(Boolean);
  const since = twelveMonthsBefore(now);
  return (dive) => {
    const day = dive.date.slice(0, 10);
    if (query.period === '12m' && day < since) return false;
    if (query.period !== 'all' && query.period !== '12m' && !day.startsWith(query.period)) {
      return false;
    }
    if (query.regions.length > 0 && !query.regions.includes(dive.site.region)) return false;
    if (query.depthMin !== null && dive.depthMaxM < query.depthMin) return false;
    if (query.depthMax !== null && dive.depthMaxM > query.depthMax) return false;
    if (query.gases.length > 0 && !query.gases.includes(gasFamily(dive.gasMix))) return false;
    if (!query.with.every((id) => dive.team.some((member) => member.id === id))) return false;
    if (terms.length > 0) {
      const text = searchableText(dive);
      if (!terms.every((term) => text.includes(term))) return false;
    }
    return true;
  };
}

// The logbook number is chronological: sorting by date is sorting by number, without parsing
// dates written with different offsets.
const COMPARATORS: Record<DivesSort, (a: LoggedDive, b: LoggedDive) => number> = {
  '-date': (a, b) => b.number - a.number,
  date: (a, b) => a.number - b.number,
  '-depth': (a, b) => b.depthMaxM - a.depthMaxM || b.number - a.number,
  '-duration': (a, b) => b.durationMin - a.durationMin || b.number - a.number,
};

export function sortDives(dives: readonly LoggedDive[], sort: DivesSort): LoggedDive[] {
  return [...dives].sort(COMPARATORS[sort]);
}

export function summarize(dives: readonly LoggedDive[]): DivesSummary {
  const byMonth: Record<string, MonthTotal> = {};
  let totalMinutes = 0;
  let depthSum = 0;
  let maxDepthM: number | null = null;
  const sites = new Set<string>();

  for (const dive of dives) {
    totalMinutes += dive.durationMin;
    depthSum += dive.depthMaxM;
    maxDepthM = Math.max(maxDepthM ?? dive.depthMaxM, dive.depthMaxM);
    sites.add(dive.site.id);
    const month = (byMonth[yearMonthOf(dive.date)] ??= { count: 0, minutes: 0 });
    month.count += 1;
    month.minutes += dive.durationMin;
  }

  return {
    count: dives.length,
    totalMinutes,
    avgDepthM: dives.length > 0 ? depthSum / dives.length : null,
    maxDepthM,
    sites: sites.size,
    byMonth,
  };
}

export function filterDives(
  dives: readonly LoggedDive[],
  query: DivesQuery,
  now: Date,
): LoggedDive[] {
  return dives.filter(matchesQuery(query, now));
}

/**
 * The filter whose removal brings back the most dives (ties: display order). `null` when there
 * are results, no filter, or no single removal helps.
 */
export function findRelaxation(
  dives: readonly LoggedDive[],
  query: DivesQuery,
  now: Date,
): Relaxation | null {
  let best: Relaxation | null = null;
  for (const filter of activeFilterKeys(query)) {
    const total = filterDives(dives, withoutFilter(query, filter), now).length;
    if (total > 0 && (best === null || total > best.total)) best = { filter, total };
  }
  return best;
}

export function selectDives(
  dives: readonly LoggedDive[],
  query: DivesQuery,
  now: Date = new Date(),
): DivesSelection {
  const selection = sortDives(filterDives(dives, query, now), query.sort);
  const total = selection.length;
  const pageCount = Math.max(1, Math.ceil(total / query.size));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * query.size;

  return {
    items: selection.slice(start, start + query.size),
    total,
    page,
    pageCount,
    summary: summarize(selection),
    relaxation: total === 0 ? findRelaxation(dives, query, now) : null,
  };
}

export function computeFacets(dives: readonly LoggedDive[]): DivesFacets {
  const regions = Object.fromEntries(REGION_KEYS.map((key) => [key, 0])) as DivesFacets['regions'];
  const members = new Map<string, DivesFacets['members'][number]>();

  for (const dive of dives) {
    regions[dive.site.region] += 1;
    for (const member of dive.team) {
      if (member.isSelf) continue;
      const entry = members.get(member.id);
      if (entry) entry.count += 1;
      else members.set(member.id, { member, count: 1 });
    }
  }

  return {
    regions,
    members: [...members.values()].sort(
      (a, b) => b.count - a.count || a.member.firstName.localeCompare(b.member.firstName, 'fr'),
    ),
  };
}

export function describeLog(dives: readonly LoggedDive[]): DiveLogOverview {
  const first = sortDives(dives, 'date')[0];
  const divers = new Set(
    dives.flatMap((dive) => dive.team.filter((member) => !member.isSelf).map(({ id }) => id)),
  );
  return {
    totalDives: dives.length,
    firstDiveDate: first?.date ?? null,
    diverCount: divers.size,
  };
}
