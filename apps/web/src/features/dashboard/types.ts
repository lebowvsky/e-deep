// DiveLog — dashboard domain types (local to the front until the API exposes them via @e-deep/shared).

export type UserLevel = 'N1' | 'N2' | 'N3' | 'N4';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  level: UserLevel;
  federation: 'FFESSM' | 'CMAS' | 'OTHER';
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
  temperatureC: number;
  visibilityM: number;
  gasMix: 'AIR' | 'NITROX32' | 'NITROX36' | 'OTHER';
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
  divesPerMonth: { month: string; count: number }[]; // last 12 months
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
export type DashboardState =
  | { status: 'loading' }
  | { status: 'empty'; user: User }
  | { status: 'ready'; data: DashboardPayload };
