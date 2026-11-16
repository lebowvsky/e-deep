import type { SyncedWrite } from '../../common/sync/sync.types';
import type {
  CurrentStrength,
  EntryType,
  SeaState,
  SuitType,
  TankMaterial,
  TimeOfDay,
  Weather,
} from './dive-detail-lists';
import type { DiveEvent } from './dive-event.entity';
import type { DiveParticipation } from './dive-participation.entity';
import type { GasMix } from './gas-mix';

/**
 * Every field is required, `null` included (D-22): the LWW upsert writes the whole record, so a
 * field omitted by an outdated client would silently erase the stored value.
 */
export interface DiveEventWrite extends SyncedWrite {
  readonly id: string;
  readonly siteId: string;
  readonly startedAt: Date;
  readonly utcOffsetMinutes: number;
  // Type and conditions (D-13, D-18): written by the creator only.
  readonly entryType: EntryType | null;
  readonly timeOfDay: TimeOfDay | null;
  readonly weather: Weather | null;
  readonly airTemperatureC: number | null;
  readonly seaState: SeaState | null;
  readonly currentStrength: CurrentStrength | null;
  readonly diveCenter: string | null;
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
  // Detail (D-15 to D-17); required, `null` = not entered (D-22).
  readonly surfaceWaterTemperatureC: number | null;
  /** Safety stop: both set or both `null` (RG-25). */
  readonly safetyStopDurationMin: number | null;
  readonly safetyStopDepthM: number | null;
  readonly isRepetitive: boolean | null;
  /** Only with `gasMix: 'OTHER'` (RG-23). */
  readonly o2Percent: number | null;
  readonly tankVolumeL: number | null;
  readonly tankMaterial: TankMaterial | null;
  readonly startPressureBar: number | null;
  readonly endPressureBar: number | null;
  readonly suitType: SuitType | null;
  readonly suitThicknessMm: number | null;
  readonly weightKg: number | null;
}

/** A species seen during the dive (D-19). The position is the index in `DiveWrite.observations`. */
export interface DiveObservationWrite {
  /** Trimmed before writing; two labels equal after trimming are refused. */
  readonly label: string;
  readonly count: number | null;
}

/** Stored observation, as pulled: ordered by position. */
export interface DiveObservationValue {
  readonly label: string;
  readonly count: number | null;
}

/**
 * A dive, as the front sees it: the event, the diver's participation, its dive team and its
 * observations (both replaced as a whole).
 */
export interface DiveWrite {
  readonly event: DiveEventWrite;
  readonly participation: DiveParticipationWrite;
  readonly buddyIds: readonly string[];
  /** 0 to 50 species, in display order. */
  readonly observations: readonly DiveObservationWrite[];
}

export interface Dive {
  readonly event: DiveEvent;
  readonly participation: DiveParticipation;
  readonly buddyIds: readonly string[];
  readonly observations: readonly DiveObservationValue[];
}

/** A participation as pulled, with its dive team and its observations (ordered by position). */
export interface ParticipationWithBuddies {
  readonly participation: DiveParticipation;
  readonly buddyIds: readonly string[];
  readonly observations: readonly DiveObservationValue[];
}

/** Type and conditions of the event (D-13, D-18), as written. */
export type DiveEventConditionsWrite = Pick<
  DiveEventWrite,
  | 'entryType'
  | 'timeOfDay'
  | 'weather'
  | 'airTemperatureC'
  | 'seaState'
  | 'currentStrength'
  | 'diveCenter'
>;

/** Profile, gas and equipment of the participation (D-15 to D-17), as written. */
export type DiveParticipationDetailWrite = Pick<
  DiveParticipationWrite,
  | 'surfaceWaterTemperatureC'
  | 'safetyStopDurationMin'
  | 'safetyStopDepthM'
  | 'isRepetitive'
  | 'o2Percent'
  | 'tankVolumeL'
  | 'tankMaterial'
  | 'startPressureBar'
  | 'endPressureBar'
  | 'suitType'
  | 'suitThicknessMm'
  | 'weightKg'
>;

/** Nothing entered: every condition `null`. */
export const NO_EVENT_CONDITIONS: DiveEventConditionsWrite = {
  entryType: null,
  timeOfDay: null,
  weather: null,
  airTemperatureC: null,
  seaState: null,
  currentStrength: null,
  diveCenter: null,
};

/** Nothing entered: every detail field `null`. */
export const NO_PARTICIPATION_DETAIL: DiveParticipationDetailWrite = {
  surfaceWaterTemperatureC: null,
  safetyStopDurationMin: null,
  safetyStopDepthM: null,
  isRepetitive: null,
  o2Percent: null,
  tankVolumeL: null,
  tankMaterial: null,
  startPressureBar: null,
  endPressureBar: null,
  suitType: null,
  suitThicknessMm: null,
  weightKg: null,
};
