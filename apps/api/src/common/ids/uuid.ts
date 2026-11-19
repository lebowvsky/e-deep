/**
 * Canonical spelling of a UUID: lowercase, as PostgreSQL returns it. Clients may send uppercase
 * ids; every comparison, set, sort or lock key on ids goes through this form.
 */
export function normalizeUuid(id: string): string {
  return id.toLowerCase();
}

/** Whether two UUIDs are the same, whatever their case. */
export function isSameUuid(left: string, right: string): boolean {
  return normalizeUuid(left) === normalizeUuid(right);
}

/**
 * A set of UUIDs in canonical form: normalised, deduplicated, sorted. Sorted ids also give the
 * order in which rows are locked, so that two transactions on the same rows cannot deadlock.
 */
export function canonicalUuids(ids: readonly string[]): string[] {
  return [...new Set(ids.map(normalizeUuid))].sort();
}
