import { cx } from '@/shared/lib/classNames';
import { formatClock } from '@/shared/lib/format';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import styles from './DiveFormActions.module.scss';

export interface DiveFormActionsProps {
  /** « Enregistrer la plongée » or « Enregistrer les modifications ». */
  submitLabel: string;
  /** A save is running: « Enregistrement… », disabled and `aria-busy`. */
  isBusy: boolean;
  /** Where « Annuler » goes. */
  cancelHref: string;
  /** Time of the latest draft written on the device, `null` before the first one. */
  draftSavedAt: Date | null;
  /**
   * column: right column (≥ 1280px), 48px save button.
   * bar: under the form — sticky bottom bar below 1280px (full width save and the draft mention,
   * « Annuler » being the ✕ or the breadcrumb), a right-aligned row from 1280px.
   */
  layout: 'column' | 'bar';
  className?: string | undefined;
}

/** Save (submits the enclosing form), cancel and the draft mention. */
export function DiveFormActions({
  submitLabel,
  isBusy,
  cancelHref,
  draftSavedAt,
  layout,
  className,
}: DiveFormActionsProps) {
  const save = (
    <Button
      type="submit"
      variant="primary"
      size="lg"
      icon="check"
      className={styles.save}
      disabled={isBusy}
      aria-busy={isBusy || undefined}
    >
      {isBusy ? 'Enregistrement…' : submitLabel}
    </Button>
  );
  const cancel = (
    <ButtonLink to={cancelHref} variant="ghost" className={styles.cancel}>
      Annuler
    </ButtonLink>
  );
  const draft = draftSavedAt !== null && (
    <p className={styles.draft}>
      <Icon name="cloud" size="sm" />
      Brouillon enregistré sur l’appareil · {formatClock(draftSavedAt)}
    </p>
  );

  return (
    <div className={cx(styles.actions, styles[layout], className)}>
      {layout === 'column' ? (
        <>
          {save}
          {cancel}
        </>
      ) : (
        <div className={styles.buttons}>
          {cancel}
          {save}
        </div>
      )}
      {draft}
    </div>
  );
}
