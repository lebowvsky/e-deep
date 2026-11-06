import { LayoutDashboard, type LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Sidebar entries. Access control: once roles exist, each item will declare the roles allowed
 * to see it and the sidebar will filter on the session roles (UX only, the API enforces access).
 * See `../access-control/README.md`.
 */
export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
] as const satisfies readonly NavItem[];

export type NavItemId = (typeof NAV_ITEMS)[number]['id'];
