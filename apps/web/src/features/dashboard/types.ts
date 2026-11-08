// DiveLog — dashboard view model. The API contract is `DashboardResponse` (@e-deep/shared);
// `api/dashboardApi.ts` maps it to these types, which the components consume.
import type { Federation, GasMix, UserLevel } from '@e-deep/shared';

export type { UserLevel };

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  level: UserLevel;
  federation: Federation;
  avatarUrl?: string;
}

export interface DiveSite {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  diveCount: number;
  maxDepthM: number;
}

export interface Buddy {
  id: string;
  initials: string;
  firstName: string;
  lastName: string;
  sharedDives: number;
  accentColor?: string; // for avatar bg
}

export interface Dive {
  id: string;
  date: string; // ISO
  site: Pick<DiveSite, 'id' | 'name' | 'region'>;
  depthMaxM: number;
  durationMin: number;
  /** `null` when not entered. */
  temperatureC: number | null;
  /** `null` when not entered. */
  visibilityM: number | null;
  gasMix: GasMix;
  hadDecompression: boolean;
  stopsOk: boolean;
  buddies: Buddy[];
  notes?: string;
}

export interface DashboardStats {
  totalDives: number;
  totalUnderwaterMinutes: number;
  maxDepthEver: { depthM: number; site: string; date: string };
  sitesVisited: number;
  /** Last 12 months, oldest first; `month` is the short French label (« sept »). */
  divesPerMonth: { month: string; count: number }[];
  /** Dives of the current month (« +3 ce mois »). */
  recentMonthDelta: number;
  /** Where most dives happen: short name (header, KPI) and map title. */
  mainArea: { name: string; mapTitle: string };
}

export interface DashboardPayload {
  user: User;
  stats: DashboardStats;
  lastDive: Dive | null;
  sites: DiveSite[];
  frequentBuddies: Buddy[];
}

// State of the dashboard loader. The dashboard renders differently for each:
//  - loading  → skeletons
//  - empty    → onboarding CTA
//  - ready    → nominal
//  - error    → message + retry
export type DashboardState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'empty'; user: User }
  | { status: 'ready'; data: DashboardPayload };
