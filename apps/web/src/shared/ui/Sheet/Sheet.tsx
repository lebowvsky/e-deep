import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useBodyScrollLock } from '@/shared/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { IconButton } from '@/shared/ui/IconButton';
import styles from './Sheet.module.scss';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Extra action next to the close button (« Réinitialiser »). */
  action?: ReactNode;
  /** Sticky footer (main action). */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Bottom sheet (dives-list.jsx · DivesMobileFilters): modal dialog over a scrim. Closes on Esc and
 * on the scrim, traps the focus and gives it back on close, locks the page scroll.
 */
export function Sheet({ open, onClose, title, action, footer, children }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
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
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <span className={styles.handle} aria-hidden="true" />
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <div className={styles.actions}>
            {action}
            <IconButton
              icon="close"
              iconSize="lg"
              label="Fermer"
              onClick={onClose}
              className={styles.close}
            />
          </div>
        </div>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
