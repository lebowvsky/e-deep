import type { GasMix } from './dashboard.js';

/** Site of a dive, as listed in the dive log. */
export interface DiveSiteRef {
  id: string;
  name: string;
  /** Town or spot of the site (e.g. `Calvi`), `null` when not entered. */
  locality: string | null;
  /** `null` when not entered (site created by its name, D-23). */
  region: string | null;
}

/** A buddy of the dive team (the diver themselves is never listed). */
export interface DiveBuddyRef {
  id: string;
  firstName: string;
  lastName: string;
}

/**
 * A dive of the diver's log, as shown in the list. Light on purpose (D25): the detail fields are in
 * `DiveDetail`, except the entry type and the dive centre, which the site page needs to show the
 * usual ones over the whole log (D32).
 */
export interface DiveSummary {
  /** Id of the dive event. */
  id: string;
  /** Chronological rank of the dive in the diver's log (oldest = 1), computed, never stored. */
  number: number;
  /** Local time of the dive, ISO 8601 with its own offset (e.g. `2026-07-14T21:00:00+03:00`). */
  date: string;
  utcOffsetMinutes: number;
  site: DiveSiteRef;
  depthMaxM: number;
  durationMin: number;
  temperatureC: number | null;
  gasMix: GasMix;
  notes: string | null;
  buddies: DiveBuddyRef[];
  /** `null` when not entered. */
  entryType: EntryType | null;
  /** Dive centre (free text), `null` when not entered. */
  diveCenter: string | null;
}

/** How the divers entered the water (shared by the dive team). */
export type EntryType = 'BOAT' | 'SHORE';
export type TimeOfDay = 'DAY' | 'NIGHT';
export type Weather = 'SUNNY' | 'CLOUDY' | 'OVERCAST' | 'RAIN';
export type SeaState = 'CALM' | 'SLIGHT' | 'MODERATE' | 'ROUGH';
export type CurrentStrength = 'NONE' | 'WEAK' | 'MODERATE' | 'STRONG';
export type TankMaterial = 'STEEL' | 'ALUMINIUM';
export type SuitType = 'WET' | 'SEMI_DRY' | 'DRY';

/** A certification level from the reference table (any agency, unlike `UserLevel`). */
export interface CertificationLevelRef {
  agency: string;
  code: string;
  label: string;
}

/** A species seen during the dive, in the order the diver entered them. */
export interface DiveObservation {
  label: string;
  /** Number of individuals, `null` when not counted. */
  count: number | null;
}

/** A buddy of the dive team with the level their contact card declares (D-21). */
export interface DiveDetailBuddy extends DiveBuddyRef {
  level: CertificationLevelRef | null;
}

/**
 * A dive with every field of the event, the participation and the site. Fields stay flat: the
 * front groups them into cards. Every field is present, `null` when not entered.
 */
export interface DiveDetail extends DiveSummary {
  site: DiveSiteRef & {
    /** Both set or both `null` (position not entered, D-23). */
    latitude: number | null;
    longitude: number | null;
    /** Sea or area of the site (e.g. `Méditerranée`). */
    area: string | null;
  };
  buddies: DiveDetailBuddy[];

  // Participation (existing)
  visibilityM: number | null;
  hadDecompression: boolean;
  stopsOk: boolean;
  /** Level of the diver at the time of the dive (snapshot, D-09). */
  diverLevel: CertificationLevelRef;

  // Event: type and conditions, edited by the creator only (D-13, D-18); `entryType` and
  // `diveCenter` come with the summary (D32)
  timeOfDay: TimeOfDay | null;
  weather: Weather | null;
  airTemperatureC: number | null;
  seaState: SeaState | null;
  currentStrength: CurrentStrength | null;

  // Participation: dive profile (D-16, D-17)
  /** Water temperature at the surface; `temperatureC` is the bottom one. */
  surfaceTemperatureC: number | null;
  /** Safety stop: both set or both `null`. */
  safetyStopDurationMin: number | null;
  safetyStopDepthM: number | null;
  isRepetitive: boolean | null;

  // Participation: gas and equipment (D-15)
  /** Only for `gasMix: 'OTHER'`; AIR, NITROX32 and NITROX36 imply 21, 32 and 36. */
  o2Percent: number | null;
  tankVolumeL: number | null;
  tankMaterial: TankMaterial | null;
  startPressureBar: number | null;
  endPressureBar: number | null;
  suitType: SuitType | null;
  suitThicknessMm: number | null;
  weightKg: number | null;

  // Participation: notes (D-19)
  observations: DiveObservation[];

  /** Creation of the participation, ISO 8601 instant (UTC). */
  createdAt: string;
  /** Latest change of the event or the participation, ISO 8601 instant (UTC). */
  updatedAt: string;
}

/** `GET /api/dives`: every live dive of the diver, latest first (`started_at` DESC, `id` DESC). */
export interface DiveLogResponse {
  dives: DiveSummary[];
}
