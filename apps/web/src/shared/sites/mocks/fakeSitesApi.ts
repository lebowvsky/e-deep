// A fake of the site endpoints (`/api/sites`, D-33), for the tests that go through the screens
// and the HTTP repository: the API rules on its records, the dives reached through `dives` (the
// fake of the dive endpoints joins the sites it keeps here).
// Tests only: never imported by the application code.
import type { SiteCreateRequest, SiteResponse, SiteWriteRequest } from '@e-deep/shared';
import { ApiError } from '@/shared/lib/apiClient';
import { isRecord, isString } from '@/shared/lib/guards';
import type { Site } from '@/shared/model/site';
import { completeSiteRecord, toSiteRecord } from './siteRecords';

/** What the sites need to know of the dives. */
export interface FakeSitesDives {
  /** A live dive uses the site. */
  uses(siteId: string): boolean;
  /** Every dive of `fromId` now on `toId` (merge). */
  move(fromId: string, toId: string): void;
}

export interface FakeSitesApi {
  /** The live sites. */
  records: ReadonlyMap<string, SiteResponse>;
  /** The site a dive written on `id` lands on: the target of a merged site (RG-36). */
  resolve(id: string): string;
  /** A site created by its name from a dive (`isNew`, D-28), unless it exists. */
  createByName(id: string, name: string): SiteResponse;
  handles(path: string): boolean;
  get(path: string): unknown;
  /** Creation (an identical one answers the site again) or merge. */
  post(path: string, body: unknown): SiteResponse;
  put(path: string, body: unknown): SiteResponse;
  delete(path: string): void;
}

const SITES_PATH = 'sites';
const PREFIX = `${SITES_PATH}/`;
const MERGE_SUFFIX = '/merge';

const failure = (status: number, code?: string) =>
  new ApiError('http', `The API answered with HTTP ${status}.`, { status, code });

/**
 * Shape check of the bodies the repository sends: the keys of the contract. Their values are
 * checked by the repository's own tests.
 */
const WRITE_KEYS = [
  'id',
  'name',
  'locality',
  'region',
  'area',
  'latitude',
  'longitude',
  'type',
  'depthMinM',
  'depthMaxM',
  'accessNotes',
] as const satisfies readonly (keyof SiteWriteRequest)[];

function isWriteRequest(value: unknown): value is SiteWriteRequest {
  return isRecord(value) && isString(value.id) && WRITE_KEYS.every((key) => key in value);
}

function isCreateRequest(value: unknown): value is SiteCreateRequest {
  return isWriteRequest(value) && 'createdVia' in value && Object.keys(value).length === 12;
}

const sameContent = (record: SiteResponse, request: SiteCreateRequest) =>
  WRITE_KEYS.every((key) => record[key] === request[key]) &&
  record.createdVia === request.createdVia;

export function createFakeSitesApi({
  sites,
  dives,
  now,
}: {
  sites: readonly Site[];
  dives: FakeSitesDives;
  now: () => Date;
}): FakeSitesApi {
  const records = new Map(sites.map((site) => [site.id, toSiteRecord(site)]));
  const mergedInto = new Map<string, string>();

  const idOf = (path: string) => decodeURIComponent(path.slice(PREFIX.length));
  const recordOf = (id: string, status = 404, code?: string): SiteResponse => {
    const record = records.get(id);
    if (!record) throw failure(status, code);
    return record;
  };
  const save = (record: SiteResponse) => {
    records.set(record.id, record);
    return record;
  };
  const stamped = (request: SiteWriteRequest, createdVia: SiteResponse['createdVia']) => {
    const instant = now().toISOString();
    return { ...request, createdVia, createdAt: instant, updatedAt: instant };
  };

  return {
    records,
    resolve: (id) => mergedInto.get(id) ?? id,

    createByName(id, name) {
      const empty = { locality: null, region: null, area: null, latitude: null, longitude: null };
      const request = { id, name, ...empty, type: null, depthMinM: null, depthMaxM: null };
      return records.get(id) ?? save(stamped({ ...request, accessNotes: null }, 'quick'));
    },

    handles: (path) => path === SITES_PATH || path.startsWith(PREFIX),

    get(path) {
      if (path === SITES_PATH) {
        const sorted = [...records.values()].sort(
          (a, b) => a.name.localeCompare(b.name, 'fr') || a.id.localeCompare(b.id),
        );
        return { sites: sorted };
      }
      return recordOf(idOf(path));
    },

    post(path, body) {
      if (path.endsWith(MERGE_SUFFIX)) {
        const sourceId = idOf(path.slice(0, -MERGE_SUFFIX.length));
        const source = recordOf(sourceId);
        if (!isRecord(body) || !isString(body.targetId)) throw failure(400, 'validation-failed');
        if (body.targetId === sourceId) throw failure(422, 'merge-into-self');
        const target = recordOf(body.targetId, 422, 'invalid-reference');
        dives.move(sourceId, target.id);
        records.delete(sourceId);
        for (const [from, to] of mergedInto) if (to === sourceId) mergedInto.set(from, target.id);
        mergedInto.set(sourceId, target.id);
        const merged = completeSiteRecord(target, source, now().toISOString());
        return save(merged);
      }
      if (path !== SITES_PATH || !isCreateRequest(body)) throw failure(400, 'validation-failed');
      const existing = records.get(body.id);
      if (existing) {
        if (sameContent(existing, body)) return existing;
        throw failure(409, 'identifier-conflict');
      }
      if (mergedInto.has(body.id)) throw failure(409, 'identifier-conflict');
      const { createdVia, ...request } = body;
      return save(stamped(request, createdVia));
    },

    put(path, body) {
      const record = recordOf(idOf(path));
      if (!isWriteRequest(body) || body.id !== record.id || 'createdVia' in body) {
        throw failure(400, 'validation-failed');
      }
      return save({ ...record, ...body, updatedAt: now().toISOString() });
    },

    delete(path) {
      const id = idOf(path);
      recordOf(id);
      if (dives.uses(id)) throw failure(409, 'site-in-use');
      records.delete(id);
    },
  };
}
