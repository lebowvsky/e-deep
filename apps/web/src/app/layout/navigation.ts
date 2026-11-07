import type { IconName } from '@/shared/ui/Icon';

export interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
}

/** Main navigation — 4 entries max (Hick, design/README.md § 7). */
export const NAV_ENTRIES: readonly NavEntry[] = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/dives', label: 'Mes plongées', icon: 'dives' },
  { to: '/map', label: 'Carte', icon: 'map' },
  { to: '/stats', label: 'Statistiques', icon: 'stats' },
];

export const MAIN_NAV_LABEL = 'Navigation principale';
