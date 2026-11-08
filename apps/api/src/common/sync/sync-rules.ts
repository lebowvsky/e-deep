import { FullSyncRequiredError } from '../errors/domain-errors';
import type { SyncedWrite } from './sync.types';

const MS_PER_DAY = 86_400_000;

/** Start of the purge horizon: tombstones deleted before this instant may be purged. */
export function purgeHorizonStart(now: Date, horizonDays: number): Date {
  return new Date(now.getTime() - horizonDays * MS_PER_DAY);
}

/**
 * D-12 d: a client whose last successful pull predates the purge horizon may push records that were
 * purged meanwhile (an upsert of an unknown id is a creation): it must fully resync first.
 *
 * @throws {FullSyncRequiredError}
 */
export function assertWithinPurgeHorizon(lastPulledAt: Date, now: Date, horizonDays: number): void {
  if (lastPulledAt.getTime() < purgeHorizonStart(now, horizonDays).getTime()) {
    throw new FullSyncRequiredError();
  }
}

/** Server state needed by the deletion guard. */
export interface TombstoneState {
  readonly updatedAt: Date;
  readonly deletedAt: Date | null;
}

/**
 * D-12 a: a late device must not undo a deletion it has not seen. The write is stale when the server
 * row is a tombstone more recent than the client's `baseUpdatedAt` and the client sends it alive.
 * A restoration made with an up-to-date `baseUpdatedAt` is accepted.
 *
 * Compared at millisecond precision: both values come from `Date` (the client only ever sees the
 * millisecond-truncated `updated_at`).
 */
export function isStaleRestore(server: TombstoneState, write: SyncedWrite): boolean {
  if (server.deletedAt === null || write.deletedAt !== null) {
    return false;
  }
  return write.baseUpdatedAt === null || server.updatedAt.getTime() > write.baseUpdatedAt.getTime();
}
