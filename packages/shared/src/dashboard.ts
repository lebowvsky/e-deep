/** Current level of the diver, as the front contract knows it (FFESSM only for now, D-09). */
export type UserLevel = 'N1' | 'N2' | 'N3' | 'N4';

/** Agency of the current level: FFESSM or CMAS, any other agency is `OTHER`. */
export type Federation = 'FFESSM' | 'CMAS' | 'OTHER';

export type GasMix = 'AIR' | 'NITROX32' | 'NITROX36' | 'OTHER';

export interface DashboardUser {
  id: string;
  firstName: string;
  lastName: string;
  level: UserLevel;
  federation: Federation;
  avatarUrl: string | null;
}

export interface DashboardBuddy {
  id: string;
  firstName: string;
  lastName: string;
  /** Live dives of the diver with this buddy in the dive team. */
  sharedDives: number;
}

export interface DashboardSite {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  diveCount: number;
  maxDepthM: number;
}

export interface DashboardDive {
  id: string;
  /** Local time of the dive, ISO 8601 with its own offset (e.g. `2026-07-14T21:00:00+03:00`). */
  date: string;
  utcOffsetMinutes: number;
  site: Pick<DashboardSite, 'id' | 'name' | 'region'>;
  depthMaxM: number;
  durationMin: number;
  temperatureC: number | null;
  visibilityM: number | null;
  gasMix: GasMix;
  hadDecompression: boolean;
  stopsOk: boolean;
  notes: string | null;
  buddies: DashboardBuddy[];
}

export interface DashboardStats {
  totalDives: number;
  totalUnderwaterMinutes: number;
  /** `null` when the diver has no dive yet. */
  maxDepthEver: { depthM: number; siteName: string; date: string } | null;
  /** Distinct sites with at least one live dive. */
  sitesVisited: number;
  /** The last 12 months, oldest first, current month included. `month` is `YYYY-MM`. */
  divesPerMonth: { month: string; count: number }[];
  /** Dives of the current month. */
  divesThisMonth: number;
  /** Region with the most dives; `null` without dive. */
  mainRegion: string | null;
}

/** Response body of `GET /api/dashboard`, for the current diver. Only live dives are counted. */
export interface DashboardResponse {
  user: DashboardUser;
  stats: DashboardStats;
  lastDive: DashboardDive | null;
  /** Sites with at least one live dive. */
  sites: DashboardSite[];
  /** Up to 6 buddies, by shared dives. */
  frequentBuddies: DashboardBuddy[];
}
