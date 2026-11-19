// The `SitesRepository` port in memory, with the rules of the API (D-33): conflicting creation,
// unknown site, merge into itself, merge with the dives moved, deletion refused while a dive uses
// the site. Tests only: never imported by the application code.
import type { DiveSummary, SiteResponse } from '@e-deep/shared';
import { ApiError } from '@/shared/lib/apiClient';
import type { Site } from '@/shared/model/site';
import { toSite, toSiteWriteRequest } from '../api/siteContract';
import type { SitesRepository } from '../repository/sitesRepository';
import { completeSiteRecord, toDiveSiteRef, toSiteRecord } from './siteRecords';

/**
 * The dive log the test serves as `GET /dives` (read `dives` at each call): the repository moves
 * its dives on a merge, and refuses to delete a site it uses.
 */
export interface MemoryDiveLog {
  dives: DiveSummary[];
}

export interface MemorySitesRepositoryOptions {
  sites?: readonly Site[];
  log?: MemoryDiveLog;
  /** Stamps the writes. */
  now?: () => Date;
}

/** The outcome of `run`, as the API would answer it: later, a failure rejected. */
function answer<T>(run: () => T): Promise<T> {
  try {
    return Promise.resolve(run());
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error('Memory repository failure'));
  }
}

const failure = (status: number, code?: string) =>
  new ApiError('http', `The API answered with HTTP ${status}.`, { status, code });

/** One per test: every read gets a snapshot. */
export function createMemorySitesRepository({
  sites = [],
  log = { dives: [] },
  now = () => new Date(),
}: MemorySitesRepositoryOptions = {}): SitesRepository {
  const records = new Map(sites.map((site) => [site.id, toSiteRecord(site)]));

  const recordOf = (id: string, status: number, code?: string): SiteResponse => {
    const record = records.get(id);
    if (!record) throw failure(status, code);
    return record;
  };

  /** Saves `record`: its dives, and those of the site `mergedId` merged into it, now show it. */
  const store = (record: SiteResponse, mergedId?: string): Site => {
    records.set(record.id, record);
    log.dives = log.dives.map((dive) =>
      dive.site.id === record.id || dive.site.id === mergedId
        ? { ...dive, site: toDiveSiteRef(record) }
        : dive,
    );
    return toSite(record);
  };

  return {
    list: () =>
      answer(() =>
        [...records.values()]
          .sort((a, b) => a.name.localeCompare(b.name, 'fr') || a.id.localeCompare(b.id))
          .map(toSite),
      ),

    create: ({ id, createdVia, ...draft }) =>
      answer(() => {
        if (records.has(id)) throw failure(409, 'identifier-conflict');
        const instant = now().toISOString();
        return store({
          ...toSiteWriteRequest(id, draft, null),
          createdVia,
          createdAt: instant,
          updatedAt: instant,
        });
      }),

    update: (site, changes) =>
      answer(() =>
        store({
          ...recordOf(site.id, 404),
          ...toSiteWriteRequest(site.id, changes, site),
          updatedAt: now().toISOString(),
        }),
      ),

    merge: (sourceId, targetId) =>
      answer(() => {
        const source = recordOf(sourceId, 404);
        if (sourceId === targetId) throw failure(422, 'merge-into-self');
        const target = recordOf(targetId, 422, 'invalid-reference');
        records.delete(sourceId);
        return store(completeSiteRecord(target, source, now().toISOString()), sourceId);
      }),

    remove: (id) =>
      answer(() => {
        recordOf(id, 404);
        if (log.dives.some((dive) => dive.site.id === id)) return 'in-use';
        records.delete(id);
        return 'deleted';
      }),
  };
}
