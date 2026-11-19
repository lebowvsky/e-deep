// Statistics of a site, computed from the user's dives there: never stored, never served.
import type { SiteDive, SiteStats } from '@/shared/model/site';

/** Latest first: by date, then by logbook number (two dives of the same day). */
export function byLatest(a: SiteDive, b: SiteDive): number {
  return Date.parse(b.date) - Date.parse(a.date) || b.number - a.number;
}

/** The most frequent value; on a tie, the one seen most recently. `dives`: latest first. */
function usual<T>(dives: readonly SiteDive[], valueOf: (dive: SiteDive) => T | null): T | null {
  const counts = new Map<T, number>();
  for (const dive of dives) {
    const value = valueOf(dive);
    if (value !== null) counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: { value: T; count: number } | null = null;
  // Map keeps the insertion order, latest first: a strict `>` keeps the most recent on a tie.
  for (const [value, count] of counts) {
    if (best === null || count > best.count) best = { value, count };
  }
  return best?.value ?? null;
}

function bottomTemperature(dives: readonly SiteDive[]): SiteStats['bottomTemperature'] {
  const temperatures = dives
    .map((dive) => dive.temperatureC)
    .filter((value): value is number => value !== null);
  if (temperatures.length === 0) return null;
  const sum = temperatures.reduce((total, value) => total + value, 0);
  return {
    averageC: Math.round((sum / temperatures.length) * 10) / 10,
    minC: Math.min(...temperatures),
    maxC: Math.max(...temperatures),
  };
}

/** Statistics of a site from the user's dives there, in any order. */
export function computeSiteStats(siteDives: readonly SiteDive[]): SiteStats {
  const dives = [...siteDives].sort(byLatest);
  const latest = dives[0];
  const oldest = dives.at(-1);
  // Latest first: the first deepest dive found is the latest one on a tie.
  const deepest = dives.reduce<SiteDive | undefined>(
    (best, dive) => (best === undefined || dive.depthMaxM > best.depthMaxM ? dive : best),
    undefined,
  );
  const totalMinutes = dives.reduce((total, dive) => total + dive.durationMin, 0);

  return {
    diveCount: dives.length,
    firstDiveDate: oldest?.date ?? null,
    lastDive: latest ? { id: latest.id, number: latest.number, date: latest.date } : null,
    maxDepth: deepest
      ? { depthM: deepest.depthMaxM, number: deepest.number, date: deepest.date }
      : null,
    totalMinutes,
    averageMinutes: dives.length === 0 ? null : Math.round(totalMinutes / dives.length),
    bottomTemperature: bottomTemperature(dives),
    usualEntryType: usual(dives, (dive) => dive.entryType),
    usualDiveCenter: usual(dives, (dive) => dive.diveCenter),
  };
}
