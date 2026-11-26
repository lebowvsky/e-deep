import type { StaffRole } from '@e-deep/shared';
import { LayoutDashboard, type LucideIcon } from 'lucide-react';
import { STAFF_ROLES } from '@/shared/lib/staffRoles';
import { canAccess } from '../access-control/canAccess';
import type { AdminSession } from '../access-control/session';

export interface NavItem {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  /** Roles that see the item; the `allowedRoles` of its route (`routes.tsx`), checked by `navigation.test.ts`. */
  allowedRoles: readonly StaffRole[];
}

/** Sidebar entries. Hiding an item is UX only: the route guard and the API refuse it as well. */
export const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    to: '/',
    icon: LayoutDashboard,
    allowedRoles: STAFF_ROLES,
  },
] as const satisfies readonly NavItem[];

/** The items `session` may see, in their order (`canAccess`, as the route guard does). */
export function navItemsFor(
  session: Pick<AdminSession, 'role'>,
  items: readonly NavItem[],
): NavItem[] {
  return items.filter((item) => canAccess(session, item.allowedRoles));
}
