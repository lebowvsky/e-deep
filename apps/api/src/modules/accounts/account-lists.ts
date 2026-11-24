import type { AccountRole, StaffRole } from '@e-deep/shared';

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

/** Roles allowed on the admin back office (D42): every role but `diver`. */
export const STAFF_ROLES = ['support', 'admin'] as const satisfies readonly StaffRole[];

/** Narrows a role to a staff one, without any cast. */
export function isStaffRole(role: AccountRole): role is StaffRole {
  return STAFF_ROLES.some((staffRole) => staffRole === role);
}
