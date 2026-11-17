import type { EntityManager } from 'typeorm';

/**
 * Serialises the transactions that write the same client-generated id, even before its row exists
 * (a row lock cannot cover an absent row): the second one waits for the first to commit. Released
 * with the transaction. The key is the lowercase id, so two spellings of a UUID share it.
 */
export async function lockIdForTransaction(manager: EntityManager, id: string): Promise<void> {
  await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [id.toLowerCase()]);
}
