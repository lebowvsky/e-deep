import type { GasMix } from './dashboard.js';

/** Site of a dive, as listed in the dive log. */
export interface DiveSiteRef {
  id: string;
  name: string;
  /** Town or spot of the site (e.g. `Calvi`), `null` when not entered. */
  locality: string | null;
  region: string;
}

/** A buddy of the dive team (the diver themselves is never listed). */
export interface DiveBuddyRef {
  id: string;
  firstName: string;
  lastName: string;
}

/** A dive of the diver's log, as shown in the list. */
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
}

/** A dive with every field of the participation and the site coordinates. */
export interface DiveDetail extends DiveSummary {
  site: DiveSiteRef & { latitude: number; longitude: number };
  visibilityM: number | null;
  hadDecompression: boolean;
  stopsOk: boolean;
}

/** `GET /api/dives`: every live dive of the diver, latest first (`started_at` DESC, `id` DESC). */
export interface DiveLogResponse {
  dives: DiveSummary[];
}
