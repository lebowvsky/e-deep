import type { SiteOrigin, SiteType } from '@e-deep/shared';

/**
 * Closed lists of a site, stored as `text` + `CHECK` (D-14, D-27, D-28). The `CHECK`s of
 * `DiveSite` and the unions of `@e-deep/shared` list the same values: adding one means a
 * migration, the shared union and the front guard (front deployed first).
 */
export const SITE_TYPES = [
  'tombant',
  'epave',
  'sec',
  'grotte',
  'herbier',
  'autre',
] as const satisfies readonly SiteType[];

export const SITE_ORIGINS = ['quick', 'full'] as const satisfies readonly SiteOrigin[];
