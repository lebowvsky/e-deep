// Dive detail — what the rest of the log says about one dive (paging, record, site, team).
import type { DiveLogInsights, DiveNeighbour, LoggedDive } from '../types';

type InsightSubject = Pick<LoggedDive, 'number' | 'depthMaxM' | 'site' | 'team'>;

function toNeighbour(dive: LoggedDive): DiveNeighbour {
  return { id: dive.id, number: dive.number, siteName: dive.site.name };
}

/**
 * One pass over the log. `dive` is the detail being read: the log may lag behind it (stale cache),
 * so the record compares with the dive itself too, and the counters never drop below 1.
 */
export function describeDiveInLog(
  log: readonly LoggedDive[],
  dive: InsightSubject,
): DiveLogInsights {
  let previous: LoggedDive | null = null;
  let next: LoggedDive | null = null;
  let deepestM = dive.depthMaxM;
  let siteDiveCount = 0;
  let siteMaxDepthM = dive.depthMaxM;
  const buddyIds = new Set(dive.team.filter((member) => !member.isSelf).map(({ id }) => id));
  const sharedDives = new Map<string, number>();

  for (const entry of log) {
    deepestM = Math.max(deepestM, entry.depthMaxM);
    if (entry.number < dive.number && (previous === null || entry.number > previous.number)) {
      previous = entry;
    }
    if (entry.number > dive.number && (next === null || entry.number < next.number)) {
      next = entry;
    }
    if (entry.site.id === dive.site.id) {
      siteDiveCount += 1;
      siteMaxDepthM = Math.max(siteMaxDepthM, entry.depthMaxM);
    }
    for (const member of entry.team) {
      if (buddyIds.has(member.id))
        sharedDives.set(member.id, (sharedDives.get(member.id) ?? 0) + 1);
    }
  }

  for (const id of buddyIds) {
    if (!sharedDives.has(id)) sharedDives.set(id, 1);
  }

  return {
    previous: previous && toNeighbour(previous),
    next: next && toNeighbour(next),
    isPersonalBest: dive.depthMaxM >= deepestM,
    site: { diveCount: Math.max(siteDiveCount, 1), maxDepthM: siteMaxDepthM },
    sharedDives,
  };
}
