import { useEffect, useRef } from 'react';
import type { User } from '@/features/dashboard/types';
import { useBodyScrollLock } from '@/shared/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { IconButton } from '@/shared/ui/IconButton';
import { Overline } from '@/shared/ui/Overline';
import { Brand } from '../Brand';
import { MAIN_NAV_LABEL, NAV_ENTRIES } from '../navigation';
import { NavItem } from '../NavItem';
import { UserCard } from '../UserCard';
import styles from './Drawer.module.scss';

export interface DrawerProps {
  id: string;
  open: boolean;
  onClose: () => void;
  user: User;
}

/**
 * Mobile navigation drawer: modal dialog, closes on Esc / scrim / navigation, traps focus and
 * gives it back to the menu button, locks the page scroll.
 */
export function Drawer({ id, open, onClose, user }: DrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  useFocusTrap(panelRef, open);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.root}>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        id={id}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
      >
        <div className={styles.head}>
          <Brand />
          <IconButton
            className={styles.close}
            icon="close"
            iconSize="xl"
            label="Fermer le menu"
            onClick={onClose}
          />
        </div>
        <Overline className={styles.heading}>Navigation</Overline>
        <nav className={styles.nav} aria-label={MAIN_NAV_LABEL}>
          {NAV_ENTRIES.map((entry) => (
            <NavItem key={entry.to} entry={entry} size="lg" onNavigate={onClose} />
          ))}
        </nav>
        <UserCard user={user} action="logout" onNavigate={onClose} />
      </aside>
    </div>
  );
}
