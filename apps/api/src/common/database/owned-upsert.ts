import type { EntityManager, EntityTarget, ObjectLiteral } from 'typeorm';
import { IdentifierConflictError } from '../errors/domain-errors';

/**
 * Idempotent upsert keyed by the client-generated `id`, without takeover:
 *
 *   INSERT … ON CONFLICT (id) DO UPDATE SET … WHERE <table>.<owner> = EXCLUDED.<owner>
 *
 * When the id already belongs to another owner, no row is affected and the write is refused with a
 * generic error. Otherwise the last write received wins (LWW per record, D-03).
 *
 * Column names come from the entity metadata; values are always bound parameters.
 *
 * @throws {IdentifierConflictError}
 */
export async function upsertOwnedRow<T extends ObjectLiteral & { id: string }>(
  manager: EntityManager,
  target: EntityTarget<T>,
  ownerProperty: keyof T & string,
  values: Partial<T> & Pick<T, 'id'>,
): Promise<void> {
  const metadata = manager.connection.getMetadata(target);
  const columnName = (property: string): string => {
    const column = metadata.findColumnWithPropertyName(property);
    if (column === undefined) {
      throw new Error(`Unknown column property on ${metadata.name}`);
    }
    return quoteIdentifier(column.databaseName);
  };

  const entries = Object.entries(values).filter(([, value]) => value !== undefined);
  const columns = entries.map(([property]) => columnName(property));
  const placeholders = entries.map((_entry, index) => `$${String(index + 1)}`);
  const idColumn = columnName('id');
  const updates = columns
    .filter((column) => column !== idColumn)
    .map((column) => `${column} = EXCLUDED.${column}`);
  const table = quoteIdentifier(metadata.tableName);
  const owner = columnName(ownerProperty);

  const rows: unknown = await manager.query(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')})
     ON CONFLICT (${idColumn}) DO UPDATE SET ${updates.join(', ')}
     WHERE ${table}.${owner} = EXCLUDED.${owner}
     RETURNING ${idColumn}`,
    entries.map(([, value]) => value),
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    throw new IdentifierConflictError();
  }
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
