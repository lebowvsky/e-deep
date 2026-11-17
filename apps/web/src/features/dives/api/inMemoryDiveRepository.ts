// V1 dive writes, held in the query cache — TEMPORARY, until `POST` / `PATCH /api/dives` exist.
//
// Not a mock: it is the real store of V1, behind the `SaveDive` port. A saved dive is built as the
// API would serve it (`DiveDetail`) and written into the cache of its detail and of the log, the
// logbook numbers recomputed (D26), so that `/dives/:id` shows it at once. It lives as long as
// the cache: a refetch of the log or of the detail (after `staleTime`, or a reload) brings back the
// API's state, without the dive. To be replaced by an HTTP adapter of the same port.
import type {
  CertificationLevelRef,
  DiveDetail,
  DiveDetailBuddy,
  DiveLogResponse,
  DiveSummary,
} from '@e-deep/shared';
import type { QueryClient } from '@tanstack/react-query';
import { TEAM_LEVELS } from '../form/model';
import { isDiveDetail, isDiveLogResponse } from './divesApi';
import { divesKeys } from './queryKeys';
import type { SaveDive, SaveDiveInput, SaveDiveResult } from './saveDive';

export interface InMemoryDiveRepositoryDeps {
  queryClient: QueryClient;
  /** Level of the diver, copied on a new dive (snapshot, D-09). */
  diverLevel: CertificationLevelRef;
  now?: () => Date;
}

/** The site, as the cache knows it. */
type DetailSite = DiveDetail['site'];

/** A site created by its name: no region nor position yet (« se précisent plus tard »). */
function newSite(id: string, name: string): DetailSite {
  return { id, name, locality: null, region: '', latitude: 0, longitude: 0, area: null };
}

function cachedDetails(queryClient: QueryClient): DiveDetail[] {
  return queryClient
    .getQueriesData({ queryKey: [...divesKeys.all, 'detail'] })
    .map(([, data]) => data)
    .filter(isDiveDetail);
}

/** A site of the log: from a cached detail (with its position), else from the log summary. */
function findSite(
  id: string,
  details: readonly DiveDetail[],
  log: DiveLogResponse,
): DetailSite | null {
  const fromDetail = details.find((detail) => detail.site.id === id)?.site;
  if (fromDetail) return fromDetail;
  const fromLog = log.dives.find((dive) => dive.site.id === id)?.site;
  // The log summary has no position: the mini map shows the default point until a refetch.
  return fromLog ? { ...fromLog, latitude: 0, longitude: 0, area: null } : null;
}

function toLevelRef(code: string | null): CertificationLevelRef | null {
  if (code === null) return null;
  const label = TEAM_LEVELS.find((level) => level.code === code)?.label ?? code;
  return { agency: 'FFESSM', code, label };
}

/** The `DiveDetail` the API would serve for `input` (its `number` set by `renumber`). */
export function buildDiveDetail(
  input: SaveDiveInput,
  {
    site,
    diverLevel,
    createdAt,
    updatedAt,
  }: { site: DetailSite; diverLevel: CertificationLevelRef; createdAt: string; updatedAt: string },
): DiveDetail {
  const { event, participation } = input;
  const buddies: DiveDetailBuddy[] = input.contacts.buddies.map((buddy) => ({
    id: buddy.id,
    firstName: buddy.firstName,
    lastName: buddy.lastName,
    level: toLevelRef(buddy.levelCode),
  }));
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
    buddies,
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
    observations: input.observations.map(({ label, count }) => ({ label, count })),
    createdAt,
    updatedAt,
  };
}

function toSummary(detail: DiveDetail): DiveSummary {
  return {
    id: detail.id,
    number: detail.number,
    date: detail.date,
    utcOffsetMinutes: detail.utcOffsetMinutes,
    site: {
      id: detail.site.id,
      name: detail.site.name,
      locality: detail.site.locality,
      region: detail.site.region,
    },
    depthMaxM: detail.depthMaxM,
    durationMin: detail.durationMin,
    temperatureC: detail.temperatureC,
    gasMix: detail.gasMix,
    notes: detail.notes,
    buddies: detail.buddies.map(({ id, firstName, lastName }) => ({ id, firstName, lastName })),
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

const SITE_NOT_FOUND = 'Ce site n’est plus dans ton carnet. Choisis-le à nouveau ou crée-le.';

/** `SaveDive` over the query cache. The log must be loaded: the form reads it anyway (numbers). */
export function createInMemoryDiveRepository({
  queryClient,
  diverLevel,
  now = () => new Date(),
}: InMemoryDiveRepositoryDeps): SaveDive {
  return async function saveDive(input: SaveDiveInput): Promise<SaveDiveResult> {
    // Same timing as a request: the outcome is never synchronous for the caller.
    await Promise.resolve();
    const log = queryClient.getQueryData(divesKeys.log());
    if (!isDiveLogResponse(log)) throw new Error('The dive log is not loaded.');
    const details = cachedDetails(queryClient);
    const previous =
      input.kind === 'update' ? details.find((detail) => detail.id === input.event.id) : undefined;
    if (input.kind === 'update' && !log.dives.some((dive) => dive.id === input.event.id)) {
      throw new Error('The edited dive is not in the dive log.');
    }

    const { site } = input.contacts;
    const detailSite = site.isNew ? newSite(site.id, site.name) : findSite(site.id, details, log);
    if (detailSite === null) return { ok: false, fieldErrors: { site: SITE_NOT_FOUND } };

    const timestamp = now().toISOString();
    const built = buildDiveDetail(input, {
      site: { ...detailSite, name: site.isNew ? site.name : detailSite.name },
      diverLevel: previous?.diverLevel ?? diverLevel,
      createdAt: previous?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });

    const dives = renumber([...log.dives.filter((dive) => dive.id !== built.id), toSummary(built)]);
    const numbers = new Map(dives.map((dive) => [dive.id, dive.number]));
    const detail: DiveDetail = { ...built, number: numbers.get(built.id) ?? built.number };

    queryClient.setQueryData(divesKeys.log(), { dives });
    queryClient.setQueryData(divesKeys.detail(detail.id), detail);
    // The numbers of later dives moved: their cached details follow.
    for (const other of details) {
      const number = numbers.get(other.id);
      if (other.id !== detail.id && number !== undefined && number !== other.number) {
        queryClient.setQueryData(divesKeys.detail(other.id), { ...other, number });
      }
    }
    return { ok: true, id: detail.id };
  };
}
