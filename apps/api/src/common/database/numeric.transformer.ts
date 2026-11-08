import type { ValueTransformer } from 'typeorm';

/**
 * `pg` returns `numeric` columns as strings (to keep their exact precision). The dive log only
 * stores small, bounded measures (coordinates, depth, temperature), which fit a JS `number`.
 * Shared by every `numeric` column.
 */
export const numericTransformer: ValueTransformer = {
  to: (value: number | null | undefined): number | null | undefined => value,
  from: (value: string | null): number | null => (value === null ? null : Number(value)),
};
