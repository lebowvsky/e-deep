import { useEffect, useId, useRef, useState, type FocusEvent } from 'react';
import { Link } from 'react-router';
import type { User } from '@/features/dashboard/types';
import { formatDiverLevel, formatInitials } from '@/shared/lib/format';
import { Avatar } from '@/shared/ui/Avatar';
import { Icon } from '@/shared/ui/Icon';
import styles from './UserCard.module.scss';

export interface UserCardProps {
  user: User;
  /** menu: collapsed user menu (sidebar, Hick) · logout: direct sign-out link (drawer) */
  action?: 'menu' | 'logout';
  onNavigate?: () => void;
}

/** Signed-in diver: avatar, name, level, and the account action. */
export function UserCard({ user, action = 'menu', onNavigate }: UserCardProps) {
  const fullName = `${user.firstName} ${user.lastName}`;

  return (
    <div className={styles.card}>
      <Avatar initials={formatInitials(user.firstName, user.lastName)} src={user.avatarUrl} />
      <div className={styles.identity}>
        <span className={styles.name}>{fullName}</span>
        <span className={styles.level}>{formatDiverLevel(user.level, user.federation)}</span>
      </div>
      {action === 'menu' ? (
        <UserMenu onNavigate={onNavigate} />
      ) : (
        <Link to="/logout" className={styles.action} aria-label="Déconnexion" onClick={onNavigate}>
          <Icon name="logout" size="md" />
        </Link>
      )}
    </div>
  );
}

function UserMenu({ onNavigate }: { onNavigate?: (() => void) | undefined }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    onNavigate?.();
  };

  // Close when focus leaves the toggle + menu (Tab away, click elsewhere).
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  };

  return (
    <div className={styles.menuRoot} onBlur={onBlur}>
      <button
        ref={toggleRef}
        type="button"
        className={styles.action}
        aria-label="Menu du compte"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="chevronDown" size="sm" />
      </button>
      {open && (
        <ul id={menuId} className={styles.menu}>
          <li>
            <Link to="/settings" className={styles.menuItem} onClick={close}>
              <Icon name="settings" size="md" />
              Paramètres
            </Link>
          </li>
          <li>
            <Link to="/logout" className={styles.menuItem} onClick={close}>
              <Icon name="logout" size="md" />
              Déconnexion
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}
