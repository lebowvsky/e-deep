import { useEffect, useEffectEvent, useId, useRef, type ReactNode } from 'react';
import { useBodyScrollLock } from '@/shared/hooks/useBodyScrollLock';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import { Button } from '@/shared/ui/Button';
import styles from './ConfirmDialog.module.scss';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  /**
   * Safe choice (« Rester »), also triggered by Échap and the scrim. Focused first when the dialog
   * has no `children`; otherwise the first field of `children` is.
   */
  cancelLabel: string;
  /** Choice that goes on (« Quitter »); may hold a countdown (« Supprimer définitivement 0:42 »). */
  confirmLabel: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  /** `danger` for an irreversible choice (merge, delete). Default `primary`. */
  confirmVariant?: 'primary' | 'danger';
  /** The choice cannot be made yet (a target to pick first). */
  confirmDisabled?: boolean;
  /**
   * The choice is being carried out (`aria-busy`): it stays focusable, a click does nothing. Nothing
   * cancels it either (« Annuler » is `aria-disabled`, Échap and the scrim do nothing): the request
   * runs on, and closing would hide its outcome.
   */
  confirmBusy?: boolean;
  /** Fields between the description and the buttons (the target of a merge). */
  children?: ReactNode;
}

/**
 * Modal confirmation (« Quitter sans enregistrer ? »): traps the focus, starts on the first
 * focusable element (the safe choice, or the first field of `children`), closes on Échap and on the
 * scrim unless the choice is being carried out, gives the focus back on close, locks the page
 * scroll.
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
  confirmBusy = false,
  children,
}: ConfirmDialogProps) {
  const isBlocked = confirmDisabled || confirmBusy;
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useFocusTrap(panelRef, open);
  useBodyScrollLock(open);

  // `onCancel` is often an inline arrow: read it at the key press, not as a dependency, so that the
  // listener is not removed and added again on every render.
  const cancel = () => {
    if (!confirmBusy) onCancel();
  };
  const cancelOnEscape = useEffectEvent(cancel);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelOnEscape();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.root}>
      <div className={styles.scrim} onClick={cancel} aria-hidden="true" />
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
          <Button onClick={cancel} aria-disabled={confirmBusy || undefined}>
            {cancelLabel}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={isBlocked ? undefined : onConfirm}
            aria-disabled={isBlocked || undefined}
            aria-busy={confirmBusy || undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
