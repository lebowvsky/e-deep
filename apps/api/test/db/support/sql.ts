import type { DataSource, EntityManager } from 'typeorm';

/** Typed raw SELECT for the tests (the driver returns untyped rows). */
export async function selectRows<T>(
  source: DataSource | EntityManager,
  sql: string,
  parameters: readonly unknown[] = [],
): Promise<T[]> {
  const rows: unknown = await source.query(sql, [...parameters]);
  if (!Array.isArray(rows)) {
    throw new Error('Expected rows');
  }
  return rows as T[];
}

/** Matcher for a PostgreSQL error raised by a given constraint. */
export function violating(constraint: string): unknown {
  return expect.objectContaining({
    driverError: expect.objectContaining({ constraint }) as unknown,
  });
}

/** Microsecond `updated_at` of a row, as text (a JS `Date` would truncate it). */
export async function updatedAtOf(
  source: DataSource | EntityManager,
  table: string,
  id: string,
): Promise<string> {
  const [row] = await selectRows<{ updated_at: string }>(
    source,
    `SELECT updated_at::text AS updated_at FROM "${table}" WHERE id = $1`,
    [id],
  );
  if (row === undefined) {
    throw new Error('Row not found');
  }
  return row.updated_at;
}
