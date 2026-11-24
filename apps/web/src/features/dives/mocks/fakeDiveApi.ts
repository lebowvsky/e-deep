// A fake of the dive endpoints, for the tests that go through the form: `GET /dives`,
// `GET /dives/:id`, `POST /dives` and `PUT /dives/:id` over the mocked log, and of the site
// endpoints (`/sites`, `createFakeSitesApi`) over the sites of that log. A written dive or site is
// kept and served by the next reads, the dives numbered as the API numbers them (D26) and joined
// to their site as it is now (renamed, merged).
import type {
  CertificationLevelRef,
  DiveDetail,
  DiveSummary,
  DiveWriteRequest,
  DiveWriteResponse,
  SiteResponse,
} from '@e-deep/shared';
import { ApiError, type ApiClient, type TypeGuard } from '@/shared/lib/apiClient';
import { isRecord } from '@/shared/lib/guards';
import type { Site } from '@/shared/model/site';
import { createFakeSitesApi } from '@/shared/sites/mocks/fakeSitesApi';
import { toDiveSiteRef } from '@/shared/sites/mocks/siteRecords';
import { mockSites } from '@/shared/sites/mocks/sites';
import { toCertificationLevelRef } from '../lib/levels';
import { mockFilledDiveDetail } from './diveDetailResponse';
import { mockDiveLogResponse } from './diveLogResponse';

const LOG_PATH = 'dives';
const DETAIL_PREFIX = 'dives/';
const DIVER_LEVEL: CertificationLevelRef = { agency: 'FFESSM', code: 'N2', label: 'Niveau 2' };
/** Agency of the levels offered in the dive team of the form. */
const TEAM_LEVEL_AGENCY = 'FFESSM';

/** What the detail adds to the write: the site as stored, and what the server sets. */
export interface StoredFields {
  site: DiveDetail['site'];
  diverLevel: CertificationLevelRef;
  createdAt: string;
  updatedAt: string;
}

/** The `DiveDetail` the API serves for a written dive (`number` set by `renumber`). */
export function buildDiveDetail(
  request: Pick<DiveWriteRequest, 'event' | 'participation' | 'observations' | 'buddies'>,
  { site, diverLevel, createdAt, updatedAt }: StoredFields,
): DiveDetail {
  const { event, participation } = request;
  return {
    id: event.id,
    number: 0,
    date: event.startedAt,
    utcOffsetMinutes: event.utcOffsetMinutes,
    site,
    depthMaxM: participation.maxDepthM,
    durationMin: participation.durationMin,
    temperatureC: participation.waterTemperatureC,
    gasMix: participation.gasMix,
    notes: participation.notes,
    buddies: request.buddies.map(({ id, firstName, lastName, levelCode }) => ({
      id,
      firstName,
      lastName,
      level: levelCode === null ? null : toCertificationLevelRef(levelCode, TEAM_LEVEL_AGENCY),
    })),
    visibilityM: participation.visibilityM,
    hadDecompression: participation.hasDecompression,
    stopsOk: participation.stopsOk,
    diverLevel,
    entryType: event.entryType,
    timeOfDay: event.timeOfDay,
    weather: event.weather,
    airTemperatureC: event.airTemperatureC,
    seaState: event.seaState,
    currentStrength: event.currentStrength,
    diveCenter: event.diveCenter,
    surfaceTemperatureC: participation.surfaceWaterTemperatureC,
    safetyStopDurationMin: participation.safetyStopDurationMin,
    safetyStopDepthM: participation.safetyStopDepthM,
    isRepetitive: participation.isRepetitive,
    o2Percent: participation.o2Percent,
    tankVolumeL: participation.tankVolumeL,
    tankMaterial: participation.tankMaterial,
    startPressureBar: participation.startPressureBar,
    endPressureBar: participation.endPressureBar,
    suitType: participation.suitType,
    suitThicknessMm: participation.suitThicknessMm,
    weightKg: participation.weightKg,
    observations: request.observations.map(({ label, count }) => ({ label, count })),
    createdAt,
    updatedAt,
  };
}

function toSummary(detail: DiveDetail): DiveSummary {
  const { site } = detail;
  return {
    id: detail.id,
    number: detail.number,
    date: detail.date,
    utcOffsetMinutes: detail.utcOffsetMinutes,
    site: { id: site.id, name: site.name, locality: site.locality, region: site.region },
    depthMaxM: detail.depthMaxM,
    durationMin: detail.durationMin,
    temperatureC: detail.temperatureC,
    gasMix: detail.gasMix,
    notes: detail.notes,
    buddies: detail.buddies.map(({ id, firstName, lastName }) => ({ id, firstName, lastName })),
    entryType: detail.entryType,
    diveCenter: detail.diveCenter,
  };
}

/** Logbook numbers as the API computes them (D26): rank by start instant, then id. */
export function renumber(dives: readonly DiveSummary[]): DiveSummary[] {
  const chronological = [...dives].sort(
    (a, b) => Date.parse(a.date) - Date.parse(b.date) || a.id.localeCompare(b.id),
  );
  // Latest first, like `GET /dives`.
  return chronological.map((dive, index) => ({ ...dive, number: index + 1 })).reverse();
}

/**
 * Shape check of the body the adapter sends: the top-level parts only. The adapter builds it from
 * typed values; its field by field content is checked by the adapter's own tests.
 */
function isDiveWriteRequest(value: unknown): value is DiveWriteRequest {
  return (
    isRecord(value) &&
    isRecord(value.event) &&
    isRecord(value.participation) &&
    isRecord(value.site) &&
    Array.isArray(value.observations) &&
    Array.isArray(value.buddies) &&
    'baseUpdatedAt' in value
  );
}

/** A request as the fake received it, for the assertions. */
export interface FakeDiveApiRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
}

export interface FakeDiveApi {
  client: ApiClient;
  requests: FakeDiveApiRequest[];
}

const notFound = () => new ApiError('http', 'The API answered with HTTP 404.', { status: 404 });
const invalidReference = () =>
  new ApiError('http', 'The API answered with HTTP 422.', {
    status: 422,
    code: 'invalid-reference',
  });

/** The site of a dive's detail, from its record. */
const toDetailSite = (record: SiteResponse): DiveDetail['site'] => ({
  ...toDiveSiteRef(record),
  latitude: record.latitude,
  longitude: record.longitude,
  area: record.area,
});

const LOGGED_SITES = mockSites.filter(({ id }) =>
  mockDiveLogResponse.dives.some((dive) => dive.site.id === id),
);

/**
 * The mocked log, each dive served with `detailOf` (filled by default), plus what is written.
 * `sites`: the user's sites (by default those of the mocked log). `now` stamps the writes.
 */
export function createFakeDiveApi({
  detailOf = mockFilledDiveDetail,
  sites = LOGGED_SITES,
  now = () => new Date(),
}: {
  detailOf?: (id: string) => DiveDetail;
  sites?: readonly Site[];
  now?: () => Date;
} = {}): FakeDiveApi {
  const requests: FakeDiveApiRequest[] = [];
  const written = new Map<string, DiveDetail>();
  let log: DiveSummary[] = mockDiveLogResponse.dives;
  const sitesApi = createFakeSitesApi({
    sites,
    now,
    dives: {
      uses: (siteId) => log.some((dive) => dive.site.id === siteId),
      move(fromId, toId) {
        log = log.map((dive) =>
          dive.site.id === fromId ? { ...dive, site: { ...dive.site, id: toId } } : dive,
        );
      },
    },
  });

  /** The dive joined to its site as it is now (renamed, completed, merged). */
  const joined = (dive: DiveSummary): DiveSummary => {
    const record = sitesApi.records.get(dive.site.id);
    return record ? { ...dive, site: toDiveSiteRef(record) } : dive;
  };

  const detailById = (id: string): DiveDetail | null => {
    const summary = log.find((dive) => dive.id === id);
    if (!summary) return null;
    const detail = written.get(id) ?? detailOf(id);
    const record = sitesApi.records.get(summary.site.id);
    return {
      ...detail,
      number: summary.number,
      ...(record ? { site: toDetailSite(record) } : {}),
    };
  };

  /**
   * The site of the dive: one of the user's sites (a merged one leads to its target, RG-36), or
   * a new one created by its name (`isNew`, D-28); an unknown site is refused.
   */
  const siteOf = ({ site }: DiveWriteRequest): DiveDetail['site'] => {
    const id = sitesApi.resolve(site.id);
    const record = site.isNew ? sitesApi.createByName(id, site.name) : sitesApi.records.get(id);
    if (!record) throw invalidReference();
    return toDetailSite(record);
  };

  const write = (body: unknown): DiveWriteResponse => {
    if (!isDiveWriteRequest(body)) throw new Error('Unexpected write body');
    const previous = written.get(body.event.id);
    const timestamp = now().toISOString();
    const detail = buildDiveDetail(body, {
      site: siteOf(body),
      diverLevel: previous?.diverLevel ?? DIVER_LEVEL,
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    written.set(detail.id, detail);
    log = renumber([...log.filter((dive) => dive.id !== detail.id), toSummary(detail)]);
    const number = log.find((dive) => dive.id === detail.id)?.number ?? 0;
    return { id: detail.id, number, updatedAt: timestamp };
  };

  function answer<T>(body: unknown, guard: TypeGuard<T>): Promise<T> {
    return guard(body)
      ? Promise.resolve(body)
      : Promise.reject(new ApiError('invalid-response', 'Unexpected response shape.'));
  }

  /** `respond()`, or its failure, as the client would reject it. */
  function attempt<T>(respond: () => unknown, guard: TypeGuard<T>): Promise<T> {
    try {
      return answer(respond(), guard);
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error('Fake API failure'));
    }
  }

  const client: ApiClient = {
    get(path, guard) {
      requests.push({ method: 'GET', path });
      if (sitesApi.handles(path)) return attempt(() => sitesApi.get(path), guard);
      if (path === LOG_PATH) return answer({ dives: log.map(joined) }, guard);
      const detail = path.startsWith(DETAIL_PREFIX)
        ? detailById(decodeURIComponent(path.slice(DETAIL_PREFIX.length)))
        : null;
      return detail === null ? Promise.reject(notFound()) : answer(detail, guard);
    },
    post(path, body, guard) {
      requests.push({ method: 'POST', path, body });
      if (sitesApi.handles(path)) return attempt(() => sitesApi.post(path, body), guard);
      return path === LOG_PATH ? attempt(() => write(body), guard) : Promise.reject(notFound());
    },
    put(path, body, guard) {
      requests.push({ method: 'PUT', path, body });
      if (sitesApi.handles(path)) return attempt(() => sitesApi.put(path, body), guard);
      const id = decodeURIComponent(path.slice(DETAIL_PREFIX.length));
      return path.startsWith(DETAIL_PREFIX) && detailById(id) !== null
        ? attempt(() => write(body), guard)
        : Promise.reject(notFound());
    },
    postNoContent(path, body) {
      requests.push({ method: 'POST', path, body });
      return Promise.reject(notFound());
    },
    delete(path) {
      requests.push({ method: 'DELETE', path });
      if (!sitesApi.handles(path)) return Promise.reject(notFound());
      try {
        sitesApi.delete(path);
        return Promise.resolve();
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error('Fake API failure'));
      }
    },
  };
  return { client, requests };
}
