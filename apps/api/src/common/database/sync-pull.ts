import type { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import type { PullPage, SyncCursor } from '../sync/sync.types';

export const DEFAULT_PULL_LIMIT = 500;
export const MAX_PULL_LIMIT = 1_000;

const CURSOR_ALIAS = 'sync_cursor_updated_at';

/**
 * Reads one page of a synchronised table, tombstones included, ordered by the cursor
 * `(updated_at, id)`. The caller's query builder carries the ownership filter.
 *
 * The cursor timestamp is read as text, with PostgreSQL's microseconds: a JS `Date` would truncate
 * it, and rows sharing the same millisecond would be returned again or skipped.
 */
export async function pullPage<T extends ObjectLiteral & { id: string }>(
  query: SelectQueryBuilder<T>,
  cursor: SyncCursor | null,
  limit: number = DEFAULT_PULL_LIMIT,
): Promise<PullPage<T>> {
  const alias = query.alias;
  const pageSize = Math.min(Math.max(Math.trunc(limit), 1), MAX_PULL_LIMIT);

  query
    .addSelect(
      `to_char(${alias}.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
      CURSOR_ALIAS,
    )
    .orderBy(`${alias}.updatedAt`, 'ASC')
    .addOrderBy(`${alias}.id`, 'ASC')
    // One extra row tells whether another page exists.
    .limit(pageSize + 1);

  if (cursor !== null) {
    query.andWhere(
      `(${alias}.updated_at, ${alias}.id) > (CAST(:cursorUpdatedAt AS timestamptz), CAST(:cursorId AS uuid))`,
      { cursorUpdatedAt: cursor.updatedAt, cursorId: cursor.id },
    );
  }

  // Without joins, raw rows and entities are aligned one to one.
  const { entities, raw } = await query.getRawAndEntities<Record<string, unknown>>();
  const items = entities.slice(0, pageSize);
  const last = items.at(-1);
  const lastCursor = raw[items.length - 1]?.[CURSOR_ALIAS];

  return {
    items,
    nextCursor:
      entities.length > pageSize && last !== undefined && typeof lastCursor === 'string'
        ? { updatedAt: lastCursor, id: last.id }
        : null,
  };
}
