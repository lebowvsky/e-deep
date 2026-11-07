import type { User } from '@/features/dashboard/types';
import { Overline } from '@/shared/ui/Overline';
import { Brand } from '../Brand';
import { MAIN_NAV_LABEL, NAV_ENTRIES } from '../navigation';
import { NavItem } from '../NavItem';
import { UserCard } from '../UserCard';
import styles from './Sidebar.module.scss';

export interface SidebarProps {
  user: User;
}

/** Fixed 240px sidebar (≥ 768px): brand, main navigation, collapsed user menu. */
export function Sidebar({ user }: SidebarProps) {
  return (
    <aside className={styles.sidebar}>
      <Brand className={styles.brand} />
      <nav className={styles.nav} aria-label={MAIN_NAV_LABEL}>
        <Overline className={styles.heading}>Navigation</Overline>
        {NAV_ENTRIES.map((entry) => (
          <NavItem key={entry.to} entry={entry} />
        ))}
      </nav>
      <UserCard user={user} action="menu" />
    </aside>
  );
}
