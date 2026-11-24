/** Shapes of the development seed data (`dev-seed.data.ts`, `dive-log.data.ts`). */
import type { SiteType } from '@e-deep/shared';
import type {
  DiveEventConditionsWrite,
  DiveObservationWrite,
  DiveParticipationDetailWrite,
} from '../../modules/dives/dive.types';
import type { GasMix } from '../../modules/dives/gas-mix';

export type LevelCode = 'N1' | 'N2' | 'N3' | 'N4';

/** Details of a site (D-27), each one optional: `null` when omitted. */
export interface SeedSiteDetails {
  readonly type?: SiteType;
  readonly depthMinM?: number;
  readonly depthMaxM?: number;
  readonly accessNotes?: string;
}

export interface SeedSite extends SeedSiteDetails {
  readonly key: string;
  readonly name: string;
  readonly locality: string | null;
  readonly region: string;
  /** Sea or area (D-20), `null` when not entered. */
  readonly area: string | null;
  /**
   * Both set or both `null`. A site without position was created by its name from the dive form
   * (`quick`), the others from the map (`full`), as the migration backfills them.
   */
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface SeedBuddy {
  readonly key: string;
  readonly firstName: string;
  readonly lastName: string;
  /** Key of the seeded diver account this contact is linked to. */
  readonly linkedDiverKey?: string;
  /** Current level declared on the contact (D-21); none when omitted. */
  readonly levelCode?: LevelCode;
}

/** Detail fields of a dive (D-13 to D-19); a dive without detail has every one of them `null`. */
export interface SeedDiveDetail {
  readonly conditions: Partial<DiveEventConditionsWrite>;
  readonly participation: Partial<DiveParticipationDetailWrite>;
  readonly observations?: readonly DiveObservationWrite[];
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
  readonly detail?: SeedDiveDetail;
  /** Deleted afterwards, to leave a tombstone. */
  readonly deleted?: boolean;
}

export interface SeedDiver {
  readonly key: string;
  /** Email of the diver's account (`@example.test`, a reserved domain: never a real address). */
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly levelCode: LevelCode;
  readonly sites: readonly SeedSite[];
  readonly buddies: readonly SeedBuddy[];
  readonly dives: readonly SeedDive[];
}
