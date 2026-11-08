/** Injection token of the synchronisation settings. */
export const SYNC_SETTINGS = Symbol('SYNC_SETTINGS');

export const DEFAULT_PURGE_HORIZON_DAYS = 90;

export interface SyncSettings {
  /** Tombstones older than this are purged; a client whose last pull is older must fully resync. */
  readonly purgeHorizonDays: number;
}
