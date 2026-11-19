// Dive sites: shared by the dive pages (site field of the form, detail) and the sites pages (map,
// site page). Sites are private: the user only ever sees their own.
import type {
  EntryType,
  SiteOrigin as SiteOriginContract,
  SiteResponse,
  SiteType as SiteTypeContract,
} from '@e-deep/shared';
import type { DiveMember } from './dive';
import type { GeoPoint } from './geo';

/** Sea area of a site, derived from its position, else from its region (`deriveZone`). */
export const SITE_ZONES = ['mediterranee', 'atlantique', 'manche', 'autre'] as const;
export type SiteZone = (typeof SITE_ZONES)[number];

/** Every site type of the contract (RG-31): the guard of `/sites` rejects any other one. */
export const SITE_TYPES = [
  'tombant',
  'epave',
  'sec',
  'grotte',
  'herbier',
  'autre',
] as const satisfies readonly SiteTypeContract[];
export type SiteType = (typeof SITE_TYPES)[number];

/** `quick`: created from the dive form (name, region, type); `full`: from the map panel. */
export const SITE_ORIGINS = ['quick', 'full'] as const satisfies readonly SiteOriginContract[];
export type SiteOrigin = (typeof SITE_ORIGINS)[number];

/**
 * The place as the API stores it (D-32), never shown: the screens only know the label
 * (`Site.region`, « Calvi · Corse »). Sent back as is while that label is unchanged.
 */
export type StoredPlace = Pick<SiteResponse, 'locality' | 'region' | 'area'>;

export interface Site {
  id: string;
  name: string;
  /** Label of the place, « Calvi · Corse » (locality · region); `null` when not entered. */
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
  /** Immutable (RG-34). */
  createdVia: SiteOrigin;
  /** ISO 8601 instants (UTC), set by the API. */
  createdAt: string;
  updatedAt: string;
  storedPlace: StoredPlace;
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
  /** The other members of the dive team (the user is implied). */
  buddies: DiveMember[];
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
