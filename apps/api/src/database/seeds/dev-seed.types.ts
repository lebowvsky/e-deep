/** Shapes of the development seed data (`dev-seed.data.ts`, `dive-log.data.ts`). */
import type { GasMix } from '../../modules/dives/gas-mix';

export type LevelCode = 'N1' | 'N2' | 'N3' | 'N4';

export interface SeedSite {
  readonly key: string;
  readonly name: string;
  readonly locality: string | null;
  readonly region: string;
  readonly latitude: number;
  readonly longitude: number;
}

export interface SeedBuddy {
  readonly key: string;
  readonly firstName: string;
  readonly lastName: string;
  /** Key of the seeded diver account this contact is linked to. */
  readonly linkedDiverKey?: string;
}

export interface SeedDive {
  /** Local time of the dive, ISO 8601 with its offset (e.g. `2026-04-08T10:30:00+02:00`). */
  readonly date: string;
  readonly siteKey: string;
  readonly maxDepthM: number;
  readonly durationMin: number;
  readonly waterTemperatureC: number | null;
  readonly visibilityM: number | null;
  readonly gasMix: GasMix;
  readonly hasDecompression: boolean;
  readonly stopsOk: boolean;
  readonly notes: string | null;
  readonly buddyKeys: readonly string[];
  /** Deleted afterwards, to leave a tombstone. */
  readonly deleted?: boolean;
}

export interface SeedDiver {
  readonly key: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly levelCode: LevelCode;
  readonly sites: readonly SeedSite[];
  readonly buddies: readonly SeedBuddy[];
  readonly dives: readonly SeedDive[];
}
