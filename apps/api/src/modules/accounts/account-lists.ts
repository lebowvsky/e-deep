import type { AccountRole } from '@e-deep/shared';

/**
 * Roles of an account, stored as `text` + `CHECK` (`ck_accounts__role`, D36). The `CHECK` of
 * `Account` and the `AccountRole` union of `@e-deep/shared` list the same values: adding one means
 * a migration and the shared union.
 */
export const ACCOUNT_ROLES = [
  'diver',
  'support',
  'admin',
] as const satisfies readonly AccountRole[];
