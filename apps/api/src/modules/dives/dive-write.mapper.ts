import type { DiveWriteRequest } from '@e-deep/shared';
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

/** Event fields compared as is by `isSameDiveWrite` (the id is the lookup key). */
const EVENT_FIELDS = [
  'utcOffsetMinutes',
  'entryType',
  'timeOfDay',
  'weather',
  'airTemperatureC',
  'seaState',
  'currentStrength',
  'diveCenter',
] as const satisfies readonly (keyof DiveEventWrite)[];

/**
 * Participation fields compared by `isSameDiveWrite`. Neither the id nor the level snapshot: both
 * are decided by the server.
 */
const PARTICIPATION_FIELDS = [
  'maxDepthM',
  'durationMin',
  'waterTemperatureC',
  'visibilityM',
  'gasMix',
  'hasDecompression',
  'stopsOk',
  'notes',
  'surfaceWaterTemperatureC',
  'safetyStopDurationMin',
  'safetyStopDepthM',
  'isRepetitive',
  'o2Percent',
  'tankVolumeL',
  'tankMaterial',
  'startPressureBar',
  'endPressureBar',
  'suitType',
  'suitThicknessMm',
  'weightKg',
] as const satisfies readonly (keyof DiveParticipationWrite)[];

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
    isSameList(teamOf(write.buddyIds), teamOf(current.buddyIds)) &&
    isSameList(
      write.observations.map(({ label, count }) => [label.trim(), count]),
      current.observations.map(({ label, count }) => [label, count]),
    )
  );
}

function isSameUuid(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

/** The dive team is a set: deduplicated, sorted, lowercase. */
function teamOf(buddyIds: readonly string[]): string[] {
  return [...new Set(buddyIds.map((id) => id.toLowerCase()))].sort();
}

function isSameList(left: readonly unknown[], right: readonly unknown[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
