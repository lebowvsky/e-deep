import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from 'react';
import { useBodyScrollLock } from '@/shared/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { Button } from '@/shared/ui/Button';
import styles from './ConfirmDialog.module.scss';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** Safe choice, focused first (« Rester »). Also triggered by Échap and the scrim. */
  cancelLabel: string;
  /** Choice that goes on (« Quitter »). */
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** `danger` for an irreversible choice (merge, delete). Default `primary`. */
  confirmVariant?: 'primary' | 'danger';
  /** The choice cannot be made yet (a target to pick first). */
  confirmDisabled?: boolean;
  /** Fields between the description and the buttons (the target of a merge). */
  children?: ReactNode;
}

/**
 * Modal confirmation (« Quitter sans enregistrer ? »): traps the focus, starts on the safe choice,
 * closes on Échap and on the scrim, gives the focus back on close, locks the page scroll.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmVariant = 'primary',
  confirmDisabled = false,
  children,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useFocusTrap(panelRef, open);
  useBodyScrollLock(open);

  // `onCancel` is often an inline arrow: read it at the key press, not as a dependency, so that the
  // listener is not removed and added again on every render.
  const cancel = useEffectEvent(onCancel);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.root}>
      <div className={styles.scrim} onClick={onCancel} aria-hidden="true" />
      <div
        ref={panelRef}
        className={styles.panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {description && (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        )}
        {children}
        <div className={styles.actions}>
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button
            variant={confirmVariant}
            onClick={confirmDisabled ? undefined : onConfirm}
            aria-disabled={confirmDisabled || undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
