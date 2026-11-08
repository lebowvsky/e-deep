import type { DataSource, EntityManager } from 'typeorm';

/**
 * Raw SELECT whose rows the caller describes with `T` (the driver returns untyped rows). Values are
 * always bound parameters. Keep `T` to what the SQL selects; `numeric` columns arrive as strings.
 */
export async function queryRows<T>(
  source: DataSource | EntityManager,
  sql: string,
  parameters: readonly unknown[] = [],
): Promise<T[]> {
  const rows: unknown = await source.query(sql, [...parameters]);
  if (!Array.isArray(rows)) {
    throw new Error('Expected rows from a SELECT');
  }
  return rows as T[];
}
