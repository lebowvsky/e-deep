/** Fields every synchronised write carries besides its data (protocol fields, not columns: D-12). */
export interface SyncedWrite {
  /** Last server `updated_at` seen by the client for this record; `null` for a creation. */
  readonly baseUpdatedAt: Date | null;
  /** Tombstone sent by the client; `null` for a live record. */
  readonly deletedAt: Date | null;
}

/** Outcome of a synchronised write: `rejected` keeps the server state (D-12 a), returned as `current`. */
export type SyncWriteResult<T> =
  | { readonly status: 'applied'; readonly current: T }
  | { readonly status: 'rejected'; readonly current: T };

/**
 * Opaque pull cursor on `(updated_at, id)`. `updatedAt` keeps the microsecond precision of
 * PostgreSQL (a JS `Date` would truncate it and make pages overlap).
 */
export interface SyncCursor {
  readonly updatedAt: string;
  readonly id: string;
}

export interface PullPage<T> {
  readonly items: readonly T[];
  /** `null` when this page is the last one. */
  readonly nextCursor: SyncCursor | null;
}
