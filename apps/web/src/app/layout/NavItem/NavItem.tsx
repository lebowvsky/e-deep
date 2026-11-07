import { NavLink } from 'react-router';
import { cx } from '@/shared/lib/classNames';
import { Icon } from '@/shared/ui/Icon';
import type { NavEntry } from '../navigation';
import styles from './NavItem.module.scss';

export interface NavItemProps {
  entry: NavEntry;
  /** md: sidebar (44px, edge indicator) · lg: drawer (48px, 15px label) */
  size?: 'md' | 'lg';
  onNavigate?: () => void;
}

/** Navigation link; React Router sets `aria-current="page"` on the active one. */
export function NavItem({ entry, size = 'md', onNavigate }: NavItemProps) {
  return (
    <NavLink
      to={entry.to}
      onClick={onNavigate}
      className={({ isActive }) => cx(styles.item, styles[size], isActive && styles.active)}
    >
      <Icon name={entry.icon} size={size === 'lg' ? 'xl' : 'lg'} />
      <span>{entry.label}</span>
    </NavLink>
  );
}
