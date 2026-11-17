import { cx } from '@/shared/lib/classNames';
import { Button, ButtonLink } from '@/shared/ui/Button';
import styles from './DiveFormActions.module.scss';

export interface DiveFormActionsProps {
  /** « Enregistrer la plongée » or « Enregistrer les modifications ». */
  submitLabel: string;
  /** A save is running: the button is disabled and `aria-busy`. */
  isBusy: boolean;
  /** Where « Annuler » goes. */
  cancelHref: string;
  /** column: right column, 48px save button · row: under the form, right aligned. */
  layout: 'column' | 'row';
  className?: string | undefined;
}

/** Save (submits the enclosing form) and cancel, shown in the right column and under the form. */
export function DiveFormActions({
  submitLabel,
  isBusy,
  cancelHref,
  layout,
  className,
}: DiveFormActionsProps) {
  const save = (
    <Button
      type="submit"
      variant="primary"
      size={layout === 'column' ? 'lg' : 'md'}
      icon="check"
      disabled={isBusy}
      aria-busy={isBusy || undefined}
    >
      {submitLabel}
    </Button>
  );
  const cancel = (
    <ButtonLink to={cancelHref} variant="ghost">
      Annuler
    </ButtonLink>
  );

  return (
    <div className={cx(styles.actions, styles[layout], className)}>
      {layout === 'column' ? (
        <>
          {save}
          {cancel}
        </>
      ) : (
        <>
          {cancel}
          {save}
        </>
      )}
    </div>
  );
}
