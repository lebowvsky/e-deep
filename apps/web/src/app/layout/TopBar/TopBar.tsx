import { IconButton, IconLink } from '@/shared/ui/IconButton';
import { Brand } from '../Brand';
import styles from './TopBar.module.scss';

export interface TopBarProps {
  drawerId: string;
  drawerOpen: boolean;
  onOpenMenu: () => void;
}

/** Mobile top bar (< 768px): menu button, brand, notifications. */
export function TopBar({ drawerId, drawerOpen, onOpenMenu }: TopBarProps) {
  return (
    <header className={styles.topBar}>
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
