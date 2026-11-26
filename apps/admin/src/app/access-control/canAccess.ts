import type { StaffRole } from '@e-deep/shared';
import type { AdminSession } from './session';

/**
 * Whether `session` may open a page or see a nav item allowed to `allowedRoles`. No session, or no
 * role allowed, is a refusal. UX only: the API checks every request (D37).
 */
export function canAccess(
  session: Pick<AdminSession, 'role'> | null,
  allowedRoles: readonly StaffRole[],
): boolean {
  return session !== null && allowedRoles.includes(session.role);
}
