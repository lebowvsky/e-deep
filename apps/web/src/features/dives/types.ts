// Dive log (« Mes plongées ») — view model.
//
// A logged dive aggregates the shared event (site, date, dive team) and the user's participation
// (depth, duration, temperature, gas, notes are the user's own measurements).
import type { GasMix } from '@e-deep/shared';
import type { DiveMember } from '@/shared/model/dive';

export const REGION_KEYS = ['corse', 'var', 'marseille', 'esterel', 'bretagne'] as const;
export type RegionKey = (typeof REGION_KEYS)[number];

/** Gas families of the filter: AIR · NITROX32 / NITROX36 · OTHER. */
export const GAS_FAMILIES = ['air', 'nitrox', 'other'] as const;
export type GasFamily = (typeof GAS_FAMILIES)[number];

export interface DiveSiteRef {
  id: string;
  name: string;
  /** Display label: « Calvi · Corse ». */
  place: string;
  /** Filter key; independent from `place` (« Esterel · Var » is in the `esterel` region). */
  region: RegionKey;
}

export interface LoggedDive {
  id: string;
  /** Logbook number (#127), chronological. */
  number: number;
  /** Local time of the dive, ISO 8601 with its own offset. */
  date: string;
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

/** Counters on the whole log, for the filter choices (« Corse · 31 », « Lucas · 24 »). */
export interface DivesFacets {
  regions: Record<RegionKey, number>;
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
