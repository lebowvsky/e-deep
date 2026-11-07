import type { ReactNode } from 'react';
import { Measure, type MeasureProps } from '../Measure';
import { ResponsiveText, type ResponsiveLabel } from '../ResponsiveText';
import styles from './KpiCard.module.scss';

export interface KpiCardProps extends Omit<MeasureProps, 'size' | 'className'> {
  label: ResponsiveLabel;
  caption: ResponsiveLabel;
  /** Decorative trend (Sparkline), shown from 768px. */
  trend?: ReactNode;
}

/** One headline figure (KPI row): label, big mono value, caption. */
export function KpiCard({ label, caption, trend, ...measure }: KpiCardProps) {
  return (
    <li className={styles.card}>
      <span className={styles.label}>
        <ResponsiveText text={label} />
      </span>
      <div className={styles.body}>
        <Measure size="kpi" {...measure} />
        <p className={styles.caption}>
          <ResponsiveText text={caption} />
        </p>
      </div>
      {trend}
    </li>
  );
}
