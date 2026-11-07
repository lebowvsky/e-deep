import { IconButton, IconLink } from '@/shared/ui/IconButton';
import { Brand } from '../Brand';
import styles from './TopBar.module.scss';

export interface TopBarProps {
  drawerId: string;
  drawerOpen: boolean;
  onOpenMenu: () => void;
  /** Out of reach while the drawer is open. */
  inert?: boolean;
}

/** Mobile top bar (< 768px): menu button, brand, notifications. */
export function TopBar({ drawerId, drawerOpen, onOpenMenu, inert = false }: TopBarProps) {
  return (
    <header className={styles.topBar} inert={inert}>
      <IconButton
        className={styles.menu}
        icon="menu"
        iconSize="xl"
        label="Ouvrir le menu"
        aria-expanded={drawerOpen}
        aria-controls={drawerId}
        onClick={onOpenMenu}
      />
      <Brand size="sm" />
      <IconLink
        className={styles.notifications}
        to="/notifications"
        icon="bell"
        label="Notifications, nouvelles notifications"
        dot
      />
    </header>
  );
}
