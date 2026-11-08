import type { SyncedWrite } from '../../common/sync/sync.types';
import type { DiveEvent } from './dive-event.entity';
import type { DiveParticipation } from './dive-participation.entity';
import type { GasMix } from './gas-mix';

export interface DiveEventWrite extends SyncedWrite {
  readonly id: string;
  readonly siteId: string;
  readonly startedAt: Date;
  readonly utcOffsetMinutes: number;
}

export interface DiveParticipationWrite extends SyncedWrite {
  readonly id: string;
  /**
   * Level snapshot chosen at entry time (the form proposes the current level). Kept as given, even
   * inactive or above the current level; omitted or `null` → copy of the diver's current level.
   */
  readonly certificationLevelId?: string | null;
  readonly maxDepthM: number;
  readonly durationMin: number;
  readonly waterTemperatureC: number | null;
  readonly visibilityM: number | null;
  readonly gasMix: GasMix;
  readonly hasDecompression: boolean;
  readonly stopsOk: boolean;
  readonly notes: string | null;
}

/** A dive, as the front sees it: the event, the diver's participation and its dive team. */
export interface DiveWrite {
  readonly event: DiveEventWrite;
  readonly participation: DiveParticipationWrite;
  readonly buddyIds: readonly string[];
}

export interface Dive {
  readonly event: DiveEvent;
  readonly participation: DiveParticipation;
  readonly buddyIds: readonly string[];
}

export interface ParticipationWithBuddies {
  readonly participation: DiveParticipation;
  readonly buddyIds: readonly string[];
}
