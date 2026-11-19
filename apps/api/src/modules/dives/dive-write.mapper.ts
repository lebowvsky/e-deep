import type { DiveWriteRequest } from '@e-deep/shared';
import { canonicalUuids, isSameUuid } from '../../common/ids/uuid';
import type { SyncedWrite } from '../../common/sync/sync.types';
import type { Dive, DiveEventWrite, DiveParticipationWrite, DiveWrite } from './dive.types';

/** Identity of the participation to write, decided by the server (D-24). */
export interface ParticipationIdentity {
  readonly id: string;
  /** Level snapshot to keep (D-09); `null` copies the diver's current level. */
  readonly certificationLevelId: string | null;
}

/**
 * Turns a validated request into the aggregate `upsertDive` writes: a live dive (the online
 * channel neither deletes nor restores), its team in the order sent. Site and buddies to create are
 * not part of it: they are written before (`DiveWriteService`).
 */
export function toDiveWrite(
  request: DiveWriteRequest,
  participation: ParticipationIdentity,
): DiveWrite {
  const baseUpdatedAt = request.baseUpdatedAt === null ? null : new Date(request.baseUpdatedAt);
  return {
    event: {
      ...request.event,
      startedAt: new Date(request.event.startedAt),
      baseUpdatedAt,
      deletedAt: null,
    },
    participation: {
      ...request.participation,
      id: participation.id,
      certificationLevelId: participation.certificationLevelId,
      baseUpdatedAt,
      deletedAt: null,
    },
    buddyIds: request.buddies.map(({ id }) => id),
    observations: request.observations.map(({ label, count }) => ({ label, count })),
  };
}

/**
 * Event fields compared as is by `isSameDiveWrite`: all but the id (the lookup key), the instant
 * and the site (compared apart) and the protocol fields (liveness is the caller's concern).
 */
type ComparedEventField = Exclude<
  keyof DiveEventWrite,
  'id' | 'siteId' | 'startedAt' | keyof SyncedWrite
>;

/**
 * Participation fields compared as is: all but the id and the level snapshot, both decided by the
 * server, and the protocol fields.
 */
type ComparedParticipationField = Exclude<
  keyof DiveParticipationWrite,
  'id' | 'certificationLevelId' | keyof SyncedWrite
>;

/**
 * The keys of a record that lists every field once: a field added to the write type and forgotten
 * in the record fails the typecheck, so a replay changing it cannot pass for the same creation.
 */
function everyField<K extends string>(fields: Readonly<Record<K, true>>): K[] {
  return Object.keys(fields) as K[];
}

const EVENT_FIELDS = everyField<ComparedEventField>({
  utcOffsetMinutes: true,
  entryType: true,
  timeOfDay: true,
  weather: true,
  airTemperatureC: true,
  seaState: true,
  currentStrength: true,
  diveCenter: true,
});

const PARTICIPATION_FIELDS = everyField<ComparedParticipationField>({
  maxDepthM: true,
  durationMin: true,
  waterTemperatureC: true,
  visibilityM: true,
  gasMix: true,
  hasDecompression: true,
  stopsOk: true,
  notes: true,
  surfaceWaterTemperatureC: true,
  safetyStopDurationMin: true,
  safetyStopDepthM: true,
  isRepetitive: true,
  o2Percent: true,
  tankVolumeL: true,
  tankMaterial: true,
  startPressureBar: true,
  endPressureBar: true,
  suitType: true,
  suitThicknessMm: true,
  weightKg: true,
});

/**
 * Whether `write` would leave the stored dive unchanged: same event, participation, dive team (as a
 * set) and observations (labels trimmed, in order). It lets a replayed creation (retry after a
 * timeout) succeed without writing. Liveness is the caller's concern.
 *
 * Numbers compare by value: `numeric` columns are read back as numbers, and the DTO refuses more
 * decimals than the column keeps, so a stored value equals the value sent.
 */
export function isSameDiveWrite(write: DiveWrite, current: Dive): boolean {
  return (
    isSameUuid(write.event.siteId, current.event.siteId) &&
    write.event.startedAt.getTime() === current.event.startedAt.getTime() &&
    EVENT_FIELDS.every((field) => write.event[field] === current.event[field]) &&
    PARTICIPATION_FIELDS.every(
      (field) => write.participation[field] === current.participation[field],
    ) &&
    isSameList(canonicalUuids(write.buddyIds), canonicalUuids(current.buddyIds)) &&
    isSameList(
      write.observations.map(({ label, count }) => [label.trim(), count]),
      current.observations.map(({ label, count }) => [label, count]),
    )
  );
}

function isSameList(left: readonly unknown[], right: readonly unknown[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
