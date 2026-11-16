import { cx } from '@/shared/lib/classNames';
import { formatRecordDates } from '../../../lib/diveTime';
import styles from './DiveRecordDates.module.scss';

export interface DiveRecordDatesProps {
  createdAt: string;
  updatedAt: string;
  className?: string | undefined;
}

/**
 * « Créée le 08 avr. 2026 · modifiée le 09 avr. »: technical instants, in the device time zone
 * (not the dive's). The change only when made another day.
 */
export function DiveRecordDates({ createdAt, updatedAt, className }: DiveRecordDatesProps) {
  const { created, modified } = formatRecordDates(createdAt, updatedAt);
  return (
    <p className={cx(styles.dates, className)}>
      Créée le <time dateTime={createdAt}>{created}</time>
      {modified !== null && (
        <>
          {' · '}modifiée le <time dateTime={updatedAt}>{modified}</time>
        </>
      )}
    </p>
  );
}
