// Writing a dive — the port the form depends on, and its input.
//
// The input mirrors `DiveWrite` of the API (`apps/api/src/modules/dives/dive.types.ts`): the event,
// the participation, the dive team by ids and the observations, every field present and `null`
// when not entered (D-22). The sync fields (`baseUpdatedAt`, `deletedAt`) and the participation id
// are left to the future HTTP adapter. What the API would create beforehand (a site or a buddy
// typed by name) travels in `contacts`.
import type {
  CurrentStrength,
  EntryType,
  GasMix,
  SeaState,
  SuitType,
  TankMaterial,
  TimeOfDay,
  Weather,
} from '@e-deep/shared';
import type { DiveFormField } from '../form/model';

export interface DiveEventInput {
  /** Event id, generated on the device for a new dive (D22). */
  id: string;
  siteId: string;
  /** Local time of the immersion with its own offset (`2026-04-09T10:05:00+02:00`, D-10). */
  startedAt: string;
  utcOffsetMinutes: number;
  entryType: EntryType | null;
  timeOfDay: TimeOfDay | null;
  weather: Weather | null;
  airTemperatureC: number | null;
  seaState: SeaState | null;
  currentStrength: CurrentStrength | null;
  diveCenter: string | null;
}

export interface DiveParticipationInput {
  maxDepthM: number;
  durationMin: number;
  /** Bottom water temperature. */
  waterTemperatureC: number | null;
  visibilityM: number | null;
  gasMix: GasMix;
  hasDecompression: boolean;
  stopsOk: boolean;
  notes: string | null;
  surfaceWaterTemperatureC: number | null;
  /** Both set or both `null` (RG-25). */
  safetyStopDurationMin: number | null;
  safetyStopDepthM: number | null;
  isRepetitive: boolean | null;
  /** Only with `gasMix: 'OTHER'` (RG-23). */
  o2Percent: number | null;
  tankVolumeL: number | null;
  tankMaterial: TankMaterial | null;
  startPressureBar: number | null;
  endPressureBar: number | null;
  suitType: SuitType | null;
  suitThicknessMm: number | null;
  weightKg: number | null;
}

export interface DiveObservationInput {
  label: string;
  count: number | null;
}

/** The site of the dive: one of the log, or a new one known by its name only. */
export interface SiteContactInput {
  id: string;
  name: string;
  isNew: boolean;
}

/** A buddy of the dive team, with the level chosen in the form (contact level, D-21). */
export interface BuddyContactInput {
  id: string;
  firstName: string;
  lastName: string;
  /** Level code (`N3`), `null` when unknown. */
  levelCode: string | null;
  isNew: boolean;
}

export interface SaveDiveInput {
  /** `create` for a new or duplicated dive, `update` when editing `event.id`. */
  kind: 'create' | 'update';
  event: DiveEventInput;
  participation: DiveParticipationInput;
  buddyIds: string[];
  /** In display order. */
  observations: DiveObservationInput[];
  contacts: { site: SiteContactInput; buddies: BuddyContactInput[] };
}

/** Field errors are expected rejections (validation); anything unexpected is a rejected promise. */
export type SaveDiveResult =
  { ok: true; id: string } | { ok: false; fieldErrors: Partial<Record<DiveFormField, string>> };

/** Port of the dive writes: in memory in V1, `POST` / `PATCH /api/dives` later. */
export type SaveDive = (input: SaveDiveInput) => Promise<SaveDiveResult>;
