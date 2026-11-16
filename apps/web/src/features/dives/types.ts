// Dive log (« Mes plongées ») — view model.
//
// A logged dive aggregates the shared event (site, date, dive team) and the user's participation
// (depth, duration, temperature, gas, notes are the user's own measurements).
import type {
  CertificationLevelRef,
  CurrentStrength,
  DiveObservation,
  EntryType,
  GasMix,
  SeaState,
  SuitType,
  TankMaterial,
  TimeOfDay,
  Weather,
} from '@e-deep/shared';
import type { DiveMember } from '@/shared/model/dive';

/**
 * Filter and URL key of a region: its name normalised (« Côte Vermeille » → `cote-vermeille`).
 * Regions are free text in the data, so the set of keys comes from the log itself.
 */
export type RegionKey = string;

/** Gas families of the filter: AIR · NITROX32 / NITROX36 · OTHER. */
export const GAS_FAMILIES = ['air', 'nitrox', 'other'] as const;
export type GasFamily = (typeof GAS_FAMILIES)[number];

export interface DiveSiteRef {
  id: string;
  name: string;
  /** Display label: « Calvi · Corse », or the region alone when the locality is unknown. */
  place: string;
  /** Filter key, derived from `regionName`. */
  region: RegionKey;
  /** The region as entered: « Corse ». */
  regionName: string;
}

export interface LoggedDive {
  id: string;
  /** Logbook number (#127), chronological. */
  number: number;
  /** Local time of the dive, ISO 8601 with its own offset. */
  date: string;
  /** Offset of the dive's local time, in minutes (D-10): the times shown are the dive's own. */
  utcOffsetMinutes: number;
  site: DiveSiteRef;
  /** The whole dive team, the user included (`isSelf`). */
  team: DiveMember[];
  depthMaxM: number;
  durationMin: number;
  /** `null` when not entered. */
  temperatureC: number | null;
  gasMix: GasMix;
  notes: string | null;
}

// ── Query (mirrored in the URL) ───────────────────────────────────────────────────────────────

export const DIVES_SORTS = ['-date', 'date', '-depth', '-duration'] as const;
export type DivesSort = (typeof DIVES_SORTS)[number];

/** `all`, the last 12 months, or a calendar year (« 2025 »). */
export type DivesPeriod = 'all' | '12m' | `${number}`;

export const PAGE_SIZES = [10, 20, 50] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/** Depth scale of the filter and of the depth bars (m). */
export const DEPTH_SCALE_MAX = 60;

export interface DivesQuery {
  /** Free text: site, place, team member, notes. */
  q: string;
  period: DivesPeriod;
  /** Any of these regions (OR). */
  regions: RegionKey[];
  /** Inclusive bounds (m); `null` = no bound. */
  depthMin: number | null;
  depthMax: number | null;
  /** Any of these gas families (OR). */
  gases: GasFamily[];
  /** Dived with all of these members (AND), by member id. */
  with: string[];
  sort: DivesSort;
  /** 1-based. */
  page: number;
  size: PageSize;
}

/** Filters that can be removed one by one (active chips, « remove the most restrictive »). */
export type DivesFilterKey = 'q' | 'period' | 'regions' | 'depth' | 'gases' | 'with';

// ── Result ────────────────────────────────────────────────────────────────────────────────────

export interface MonthTotal {
  count: number;
  minutes: number;
}

/** Computed on the whole filtered selection, not on the page. */
export interface DivesSummary {
  count: number;
  totalMinutes: number;
  /** `null` when the selection is empty. */
  avgDepthM: number | null;
  maxDepthM: number | null;
  sites: number;
  /** Per calendar month of the dive (`YYYY-MM`). */
  byMonth: Record<string, MonthTotal>;
}

export interface RegionFacet {
  key: RegionKey;
  name: string;
  count: number;
}

/** Counters on the whole log, for the filter choices (« Corse · 31 », « Lucas · 24 »). */
export interface DivesFacets {
  /** Regions of the log, most dived first (ties: by name). */
  regions: RegionFacet[];
  /** Members other than the user, most frequent first. */
  members: { member: DiveMember; count: number }[];
}

/** Whole log, independent from the filters (page header). */
export interface DiveLogOverview {
  totalDives: number;
  /** Date of the first dive, `null` without dive. */
  firstDiveDate: string | null;
  /** Distinct divers met, the user excluded. */
  diverCount: number;
}

/** No result: removing this filter gives `total` dives. */
export interface Relaxation {
  filter: DivesFilterKey;
  total: number;
}

export interface DivesSelection {
  /** The current page. */
  items: LoggedDive[];
  /** Size of the filtered selection. */
  total: number;
  /** Page actually shown, clamped to the page count. */
  page: number;
  pageCount: number;
  summary: DivesSummary;
  /** Only when `total` is 0 and a filter can be removed to get results. */
  relaxation: Relaxation | null;
}

export type DivesState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'empty' }
  | ({
      status: 'ready';
      log: DiveLogOverview;
      facets: DivesFacets;
      /** Size of the selection a query would give (live counter of the filters sheet). */
      count: (query: DivesQuery) => number;
    } & DivesSelection);

// ── Dive detail (`/dives/:diveId`) ────────────────────────────────────────────────────────────

/** WGS84 coordinates of a site, in degrees. */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * A member of the dive team in the detail, with a level: the user's at the time of the dive
 * (`diverLevel`, D-09), a buddy's as their contact card declares it (D-21), `null` when unknown.
 */
export interface DiveDetailMember extends DiveMember {
  level: CertificationLevelRef | null;
}

/** Safety stop of the dive (D-16): both values, or none. */
export interface SafetyStop {
  durationMin: number;
  depthM: number;
}

/** « Conditions » card: type, weather, sea and dive centre of the event (D-13, D-18). */
export interface DiveConditions {
  entryType: EntryType | null;
  timeOfDay: TimeOfDay | null;
  weather: Weather | null;
  airTemperatureC: number | null;
  seaState: SeaState | null;
  currentStrength: CurrentStrength | null;
  /** « Structure »: the dive centre. */
  diveCenter: string | null;
}

/** « Équipement & gaz » card: the user's kit (D-15). */
export interface DiveEquipment {
  /** Oxygen share of the mix: 21, 32 or 36 from the mix, entered for `OTHER` (`null` if not). */
  o2Percent: number | null;
  tankVolumeL: number | null;
  tankMaterial: TankMaterial | null;
  startPressureBar: number | null;
  endPressureBar: number | null;
  suitType: SuitType | null;
  suitThicknessMm: number | null;
  weightKg: number | null;
}

/** A logged dive with every field of the event and the participation (`GET /dives/:id`). */
export interface DiveDetailView extends LoggedDive {
  /** `area`: sea or area of the site (« Méditerranée »), `null` when not entered. */
  site: DiveSiteRef & GeoPoint & { area: string | null };
  /** The whole team, the user first, each member with a level. */
  team: DiveDetailMember[];
  /** `null` when not entered. */
  visibilityM: number | null;
  hadDecompression: boolean;
  /** Stops done as planned (entry required, D-11). */
  stopsOk: boolean;
  /** Water at the surface; `temperatureC` is the bottom one. */
  surfaceTemperatureC: number | null;
  /** `null` when not entered (or when only half of it came, against the contract). */
  safetyStop: SafetyStop | null;
  isRepetitive: boolean | null;
  conditions: DiveConditions;
  equipment: DiveEquipment;
  /** Species seen, in the order entered. */
  observations: DiveObservation[];
  /** Technical instants (UTC): creation of the participation, latest change. */
  createdAt: string;
  updatedAt: string;
}

/** The dive just before or after in the log, for paging. */
export interface DiveNeighbour {
  id: string;
  number: number;
  siteName: string;
}

/** What the rest of the log says about a dive. Needs the whole log (`GET /dives`). */
export interface DiveLogInsights {
  /** Chronological neighbours (logbook numbers); `null` at either end of the log. */
  previous: DiveNeighbour | null;
  next: DiveNeighbour | null;
  /** The deepest dive of the log (ties included). */
  isPersonalBest: boolean;
  /** The user's dives on the same site, this one included. */
  site: { diveCount: number; maxDepthM: number };
  /** Dives shared with each other member of the team, by member id (this one included). */
  sharedDives: ReadonlyMap<string, number>;
}

/** Previous / next dives of the pagers. */
export type DiveNeighbours = Pick<DiveLogInsights, 'previous' | 'next'>;

export type DiveDetailState =
  /**
   * `preview`: the dive as the cached log already knows it, to show the header at once;
   * `neighbours`: its previous / next dives, so that the pagers stay in place while paging.
   */
  | { status: 'loading'; preview: LoggedDive | null; neighbours: DiveNeighbours | null }
  /** Unknown id, another diver's dive or a malformed id: one neutral message for all. */
  | { status: 'not-found' }
  | { status: 'error'; retry: () => void }
  /** `insights` is `null` while the log loads, or when it failed: the page stays usable. */
  | { status: 'ready'; dive: DiveDetailView; insights: DiveLogInsights | null };
