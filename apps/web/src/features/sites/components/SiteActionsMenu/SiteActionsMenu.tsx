import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { cx } from '@/shared/lib/classNames';
import { Icon, type IconName } from '@/shared/ui/Icon';
import styles from './SiteActionsMenu.module.scss';

export interface SiteAction {
  id: string;
  label: string;
  icon: IconName;
  onSelect: () => void;
  tone?: 'danger';
  /** Only in the phone menu (the page shows it as a button above). */
  phoneOnly?: boolean;
}

export interface SiteActionsMenuProps {
  actions: readonly SiteAction[];
  className?: string | undefined;
}

/**
 * « … » of the site page (sites.jsx · SiteDetailDesktop): a menu button. ↓ / Entrée open it on
 * the first item, ↑ ↓ move, Échap closes and gives the focus back, a click outside closes.
 */
export function SiteActionsMenu({ actions, className }: SiteActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // The items shown at this width (the phone-only ones are hidden by CSS above).
  const visibleItems = () =>
    Array.from(
      rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    ).filter((item) => getComputedStyle(item).display !== 'none');

  const close = (giveFocusBack: boolean) => {
    setOpen(false);
    if (giveFocusBack) buttonRef.current?.focus();
  };

  // Opened: focus on the first item; a click or a focus outside closes it.
  useEffect(() => {
    if (!open) return;
    visibleItems()[0]?.focus();
    const onOutside = (event: Event) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onOutside);
    document.addEventListener('focusin', onOutside);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      document.removeEventListener('focusin', onOutside);
    };
  }, [open]);

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const visible = visibleItems();
    const index = visible.findIndex((item) => item === document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      visible[(index + step + visible.length) % visible.length]?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className={cx(styles.root, className)}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-label="Plus d’actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <Icon name="more" size="lg" />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Actions du site"
          className={styles.menu}
          onKeyDown={onMenuKeyDown}
        >
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={cx(
                styles.item,
                action.tone === 'danger' && styles.danger,
                action.phoneOnly && styles.phoneOnly,
              )}
              onClick={() => {
                close(true);
                action.onSelect();
              }}
            >
              <Icon name={action.icon} size="sm" />
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
