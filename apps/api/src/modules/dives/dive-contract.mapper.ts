import type { DiveBuddyRef, DiveDetail, DiveSummary, GasMix } from '@e-deep/shared';

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

/** Row of the dive detail query: the summary plus the remaining participation and site fields. */
export interface DiveDetailRow extends DiveSummaryRow {
  visibility_m: number | null;
  has_decompression: boolean;
  stops_ok: boolean;
  site_latitude: string;
  site_longitude: string;
}

/** Row of the dive team query: one buddy of one participation. */
export interface DiveTeamRow {
  participation_id: string;
  id: string;
  first_name: string;
  last_name: string;
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

export function toDiveDetail(row: DiveDetailRow, buddies: DiveBuddyRef[]): DiveDetail {
  const summary = toDiveSummary(row, buddies);
  return {
    ...summary,
    site: {
      ...summary.site,
      latitude: fromNumeric(row.site_latitude),
      longitude: fromNumeric(row.site_longitude),
    },
    visibilityM: row.visibility_m,
    hadDecompression: row.has_decompression,
    stopsOk: row.stops_ok,
  };
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
