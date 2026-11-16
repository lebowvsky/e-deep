import type {
  CertificationLevelRef,
  CurrentStrength,
  DiveBuddyRef,
  DiveDetail,
  DiveDetailBuddy,
  DiveObservation,
  DiveSummary,
  EntryType,
  GasMix,
  SeaState,
  SuitType,
  TankMaterial,
  TimeOfDay,
  Weather,
} from '@e-deep/shared';

const MS_PER_MINUTE = 60_000;

/**
 * Local time of a dive, as the single `date` field of the front contract: ISO 8601 with the dive's
 * own offset, e.g. `2026-07-14T21:00:00+03:00`. A 21:00 dive in the Red Sea reads 21:00 whatever the
 * time zone of the device displaying it (D-10). The instant is preserved.
 *
 * The contracts also expose `utcOffsetMinutes`, so the creator can correct it.
 */
export function toLocalDateTime(startedAt: Date, utcOffsetMinutes: number): string {
  const local = new Date(startedAt.getTime() + utcOffsetMinutes * MS_PER_MINUTE);
  // `toISOString` prints the shifted instant as if it were UTC: keep the wall-clock part only.
  const wallClock = local.toISOString().slice(0, 19);
  return `${wallClock}${formatOffset(utcOffsetMinutes)}`;
}

function formatOffset(utcOffsetMinutes: number): string {
  const sign = utcOffsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(utcOffsetMinutes);
  const hours = String(Math.trunc(absolute / 60)).padStart(2, '0');
  const minutes = String(absolute % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

/** Row of the dive log query (`DiveLogService`). `numeric` columns arrive as strings. */
export interface DiveSummaryRow {
  id: string;
  participation_id: string;
  number: number;
  started_at: Date;
  utc_offset_minutes: number;
  max_depth_m: string;
  duration_min: number;
  water_temperature_c: string | null;
  gas_mix: GasMix;
  notes: string | null;
  site_id: string;
  site_name: string;
  site_locality: string | null;
  site_region: string;
}

/**
 * Row of the dive detail query: the summary plus the remaining event, participation and site
 * fields, the diver's level snapshot and the timestamps.
 */
export interface DiveDetailRow extends DiveSummaryRow {
  visibility_m: number | null;
  has_decompression: boolean;
  stops_ok: boolean;
  site_latitude: string;
  site_longitude: string;
  site_area: string | null;
  level_agency: string;
  level_code: string;
  level_label: string;
  entry_type: EntryType | null;
  time_of_day: TimeOfDay | null;
  weather: Weather | null;
  air_temperature_c: string | null;
  sea_state: SeaState | null;
  current_strength: CurrentStrength | null;
  dive_center: string | null;
  surface_water_temperature_c: string | null;
  safety_stop_duration_min: number | null;
  safety_stop_depth_m: string | null;
  is_repetitive: boolean | null;
  o2_percent: string | null;
  tank_volume_l: string | null;
  tank_material: TankMaterial | null;
  start_pressure_bar: number | null;
  end_pressure_bar: number | null;
  suit_type: SuitType | null;
  suit_thickness_mm: string | null;
  weight_kg: string | null;
  created_at: Date;
  /** `GREATEST(event.updated_at, participation.updated_at)`. */
  updated_at: Date;
}

/** Row of the dive team query: one buddy of one participation. */
export interface DiveTeamRow {
  participation_id: string;
  id: string;
  first_name: string;
  last_name: string;
}

/** Row of the detail's dive team query: the buddy plus its current level (LEFT JOIN, D-21). */
export interface DiveDetailTeamRow extends DiveTeamRow {
  level_agency: string | null;
  level_code: string | null;
  level_label: string | null;
}

/** Row of the observations query of a participation. */
export interface DiveObservationRow {
  position: number;
  label: string;
  count: number | null;
}

export function toDiveSummary(row: DiveSummaryRow, buddies: DiveBuddyRef[]): DiveSummary {
  return {
    id: row.id,
    number: row.number,
    date: toLocalDateTime(row.started_at, row.utc_offset_minutes),
    utcOffsetMinutes: row.utc_offset_minutes,
    site: {
      id: row.site_id,
      name: row.site_name,
      locality: row.site_locality,
      region: row.site_region,
    },
    depthMaxM: fromNumeric(row.max_depth_m),
    durationMin: row.duration_min,
    temperatureC: fromNullableNumeric(row.water_temperature_c),
    gasMix: row.gas_mix,
    notes: row.notes,
    buddies,
  };
}

export function toDiveDetail(
  row: DiveDetailRow,
  buddies: DiveDetailBuddy[],
  observations: readonly DiveObservationRow[],
): DiveDetail {
  const summary = toDiveSummary(row, buddies);
  return {
    ...summary,
    site: {
      ...summary.site,
      latitude: fromNumeric(row.site_latitude),
      longitude: fromNumeric(row.site_longitude),
      area: row.site_area,
    },
    buddies,
    visibilityM: row.visibility_m,
    hadDecompression: row.has_decompression,
    stopsOk: row.stops_ok,
    diverLevel: { agency: row.level_agency, code: row.level_code, label: row.level_label },
    entryType: row.entry_type,
    timeOfDay: row.time_of_day,
    weather: row.weather,
    airTemperatureC: fromNullableNumeric(row.air_temperature_c),
    seaState: row.sea_state,
    currentStrength: row.current_strength,
    diveCenter: row.dive_center,
    surfaceTemperatureC: fromNullableNumeric(row.surface_water_temperature_c),
    safetyStopDurationMin: row.safety_stop_duration_min,
    safetyStopDepthM: fromNullableNumeric(row.safety_stop_depth_m),
    isRepetitive: row.is_repetitive,
    o2Percent: fromNullableNumeric(row.o2_percent),
    tankVolumeL: fromNullableNumeric(row.tank_volume_l),
    tankMaterial: row.tank_material,
    startPressureBar: row.start_pressure_bar,
    endPressureBar: row.end_pressure_bar,
    suitType: row.suit_type,
    suitThicknessMm: fromNullableNumeric(row.suit_thickness_mm),
    weightKg: fromNullableNumeric(row.weight_kg),
    observations: toDiveObservations(observations),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Observations in the order the diver entered them (by position, whatever the row order). */
export function toDiveObservations(rows: readonly DiveObservationRow[]): DiveObservation[] {
  return [...rows]
    .sort((left, right) => left.position - right.position)
    .map(({ label, count }) => ({ label, count }));
}

/** The detail's dive team, each buddy with its level or `null`, in the query order. */
export function toDiveDetailBuddies(rows: readonly DiveDetailTeamRow[]): DiveDetailBuddy[] {
  return rows.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    level: toLevelRef(row),
  }));
}

function toLevelRef(row: DiveDetailTeamRow): CertificationLevelRef | null {
  // The three columns come from the same LEFT JOIN: all set or all null.
  if (row.level_agency === null || row.level_code === null || row.level_label === null) {
    return null;
  }
  return { agency: row.level_agency, code: row.level_code, label: row.level_label };
}

/** Groups the team rows by participation, keeping the query order. */
export function groupDiveTeams(rows: readonly DiveTeamRow[]): Map<string, DiveBuddyRef[]> {
  const teams = new Map<string, DiveBuddyRef[]>();
  for (const row of rows) {
    const buddy: DiveBuddyRef = { id: row.id, firstName: row.first_name, lastName: row.last_name };
    const team = teams.get(row.participation_id);
    if (team === undefined) {
      teams.set(row.participation_id, [buddy]);
    } else {
      team.push(buddy);
    }
  }
  return teams;
}

// Raw SQL bypasses `numericTransformer`: same conversion, done explicitly.
function fromNumeric(value: string): number {
  return Number(value);
}

function fromNullableNumeric(value: string | null): number | null {
  return value === null ? null : fromNumeric(value);
}
