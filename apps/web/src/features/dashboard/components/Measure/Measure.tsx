import { cx } from '@/shared/lib/classNames';
import { ResponsiveText, type ResponsiveLabel } from '../ResponsiveText';
import styles from './Measure.module.scss';

export interface MeasureProps {
  value: string | number;
  unit?: ResponsiveLabel | undefined;
  /** Spoken form, value and unit together: « 42 mètres » (design/README.md § 6). */
  srText: string;
  /** kpi: KPI cards · metric: last-dive metrics */
  size: 'kpi' | 'metric';
  className?: string | undefined;
}

/** Mono tabular number with a smaller unit. Visual text is hidden from screen readers. */
export function Measure({ value, unit, srText, size, className }: MeasureProps) {
  return (
    <span className={cx(styles.measure, styles[size], className)}>
      <span className={styles.value} aria-hidden="true">
        {value}
      </span>
      {unit && (
        <span className={styles.unit} aria-hidden="true">
          <ResponsiveText text={unit} />
        </span>
      )}
      <span className={styles.srOnly}>{srText}</span>
    </span>
  );
}
