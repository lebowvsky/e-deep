// Dive detail — what the rest of the log says about one dive (paging, record, site, team).
import { othersInTeam } from '@/shared/model/dive';
import type { DiveLogInsights, DiveNeighbour, LoggedDive } from '../types';

type InsightSubject = Pick<LoggedDive, 'id' | 'number' | 'depthMaxM' | 'site' | 'team'>;

function toNeighbour(dive: LoggedDive): DiveNeighbour {
  return { id: dive.id, number: dive.number, siteName: dive.site.name };
}

/**
 * One pass over the log. `dive` is the fresh detail being read; the cached log may lag behind it
 * (missing dive, or an older copy of it). So the log's own copy of the dive is skipped and the
 * detail is counted instead: the dive always counts once, with its current values.
 */
export function describeDiveInLog(
  log: readonly LoggedDive[],
  dive: InsightSubject,
): DiveLogInsights {
  let previous: LoggedDive | null = null;
  let next: LoggedDive | null = null;
  let deepestM = dive.depthMaxM;
  let siteDiveCount = 1;
  let siteMaxDepthM = dive.depthMaxM;
  const sharedDives = new Map(othersInTeam(dive.team).map(({ id }) => [id, 1]));

  for (const entry of log) {
    if (entry.id === dive.id) continue;
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
      const shared = sharedDives.get(member.id);
      if (shared !== undefined) sharedDives.set(member.id, shared + 1);
    }
  }

  return {
    previous: previous && toNeighbour(previous),
    next: next && toNeighbour(next),
    isPersonalBest: dive.depthMaxM >= deepestM,
    site: { diveCount: siteDiveCount, maxDepthM: siteMaxDepthM },
    sharedDives,
  };
}
