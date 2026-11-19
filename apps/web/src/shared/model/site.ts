// Dive sites: shared by the dive pages (site field of the form, detail) and the sites pages (map,
// site page). Sites are private: the user only ever sees their own.
import type { EntryType } from '@e-deep/shared';
import type { GeoPoint } from './geo';

/** Sea area of a site, derived from its position, else from its region (`deriveZone`). */
export const SITE_ZONES = ['mediterranee', 'atlantique', 'manche', 'autre'] as const;
export type SiteZone = (typeof SITE_ZONES)[number];

export const SITE_TYPES = ['tombant', 'epave', 'sec', 'grotte', 'herbier', 'autre'] as const;
export type SiteType = (typeof SITE_TYPES)[number];

/** `quick`: created from the dive form (name, region, type); `full`: from the map panel. */
export type SiteOrigin = 'quick' | 'full';

export interface Site {
  id: string;
  name: string;
  /** Free text, « Calvi · Corse »; `null` when not entered. */
  region: string | null;
  zone: SiteZone;
  type: SiteType | null;
  /** Usual depth range of the site (m), not the user's own depths. */
  depthMinM: number | null;
  depthMaxM: number | null;
  /** `null`: « Position à préciser ». Both coordinates or none. */
  position: GeoPoint | null;
  /** « Accès & conseils » */
  accessNotes: string | null;
  createdVia: SiteOrigin;
  /** ISO 8601 instants; `null` for a site read from the API, which does not serve them yet. */
  createdAt: string | null;
  updatedAt: string | null;
}

/** What the user enters for a site (creation or edition): everything but the bookkeeping. */
export type SiteDraft = Pick<
  Site,
  'name' | 'region' | 'type' | 'depthMinM' | 'depthMaxM' | 'position' | 'accessNotes'
>;

/** One of the user's dives on a site, as the statistics need it. */
export interface SiteDive {
  id: string;
  /** Logbook number (#127). */
  number: number;
  /** Local time of the dive, ISO 8601 with its own offset. */
  date: string;
  depthMaxM: number;
  durationMin: number;
  /** Bottom temperature, `null` when not entered. */
  temperatureC: number | null;
  /** Detail fields: `null` when not entered, or not known from the log (`GET /dives`). */
  entryType: EntryType | null;
  diveCenter: string | null;
}

/** Computed from the user's dives on the site, never stored. */
export interface SiteStats {
  diveCount: number;
  /** `null` without dive. */
  firstDiveDate: string | null;
  lastDive: { id: string; number: number; date: string } | null;
  /** The user's deepest dive here (the latest one on a tie). */
  maxDepth: { depthM: number; number: number; date: string } | null;
  totalMinutes: number;
  /** Rounded to the minute; `null` without dive. */
  averageMinutes: number | null;
  /** Over the dives with a temperature; `null` when none has one. */
  bottomTemperature: { averageC: number; minC: number; maxC: number } | null;
  /** Most frequent value (ties: the most recent); `null` when never entered. */
  usualEntryType: EntryType | null;
  usualDiveCenter: string | null;
}

/** A site with its statistics and its dives (latest first). */
export interface SiteEntry {
  site: Site;
  stats: SiteStats;
  dives: SiteDive[];
}
