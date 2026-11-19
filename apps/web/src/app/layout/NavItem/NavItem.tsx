import { Link, matchPath, useLocation } from 'react-router';
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

/**
 * Navigation link, active on its page and the pages under it (`aria-current="page"`, as React
 * Router's `NavLink`), and on the other pages of its section (`entry.section`, a site page under
 * « Carte »: `aria-current="location"`).
 */
export function NavItem({ entry, size = 'md', onNavigate }: NavItemProps) {
  const { pathname } = useLocation();
  const isPage = matchPath({ path: entry.to, end: false }, pathname) !== null;
  const inSection = (entry.section ?? []).some((path) => matchPath(path, pathname) !== null);
  const current = isPage ? 'page' : inSection ? 'location' : undefined;
  return (
    <Link
      to={entry.to}
      onClick={onNavigate}
      aria-current={current}
      className={cx(styles.item, styles[size], current && styles.active)}
    >
      <Icon name={entry.icon} size={size === 'lg' ? 'xl' : 'lg'} />
      <span>{entry.label}</span>
    </Link>
  );
}
