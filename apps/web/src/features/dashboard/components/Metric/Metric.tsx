import { Measure, type MeasureProps } from '@/shared/ui/Measure';
import { ResponsiveText, type ResponsiveLabel } from '@/shared/ui/ResponsiveText';
import styles from './Metric.module.scss';

export interface MetricProps extends Omit<MeasureProps, 'size' | 'className'> {
  label: ResponsiveLabel;
}

/** Labelled dive measurement (last dive card). */
export function Metric({ label, ...measure }: MetricProps) {
  return (
    <div className={styles.metric}>
      <span className={styles.label} aria-hidden="true">
        <ResponsiveText text={label} />
      </span>
      <Measure size="metric" {...measure} />
    </div>
  );
}
