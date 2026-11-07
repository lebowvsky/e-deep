import { useId } from 'react';
import { cx } from '@/shared/lib/classNames';
import { formatDiveCount, formatMonthInitial } from '@/shared/lib/format';
import { Overline } from '@/shared/ui/Overline';
import type { DashboardStats } from '../../types';
import { ResponsiveText } from '../ResponsiveText';
import styles from './DivesPerMonthChart.module.scss';

export interface DivesPerMonthChartProps {
  months: DashboardStats['divesPerMonth'];
}

/**
 * 12-month histogram. Bars are proportional to the busiest month, which is highlighted with its
 * value (mobile mockup behaviour — the desktop mockup squashes the bars, design/README.md § 5.1).
 * The drawing is decorative; a visually-hidden table carries the data.
 */
export function DivesPerMonthChart({ months }: DivesPerMonthChartProps) {
  const titleId = useId();
  const total = months.reduce((sum, month) => sum + month.count, 0);
  const max = Math.max(0, ...months.map((month) => month.count));
  const peak = max > 0 ? months.find((month) => month.count === max) : undefined;

  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <Overline>
            <ResponsiveText text={{ short: 'Plongées · 12 mois', long: 'Plongées par mois' }} />
          </Overline>
          <h2 id={titleId} className={styles.title}>
            <ResponsiveText text={{ short: formatDiveCount(total), long: '12 derniers mois' }} />
          </h2>
        </div>
        <p className={styles.total}>
          <span className={styles.totalValue}>{total}</span>
          <span className={styles.totalLabel}>Total · 12M</span>
        </p>
        {peak && <p className={styles.peakNote}>pic · {peak.month}.</p>}
      </header>

      <div className={styles.chart} aria-hidden="true">
        <div className={styles.bars}>
          {months.map((month, index) => (
            <div key={`${month.month}-${index}`} className={styles.column}>
              {month === peak && <span className={styles.peakValue}>{month.count}</span>}
              <span
                className={cx(
                  styles.bar,
                  month === peak && styles.peak,
                  month.count === 0 && styles.zero,
                )}
                // Data-driven height (inline style allowed, apps/web/CLAUDE.md).
                style={{ height: `${max ? (month.count / max) * 100 : 0}%` }}
              />
            </div>
          ))}
        </div>
        <div className={styles.axis}>
          {months.map((month, index) => (
            <span key={`${month.month}-${index}`} className={styles.month}>
              <ResponsiveText
                text={{ short: formatMonthInitial(month.month), long: month.month }}
              />
            </span>
          ))}
        </div>
      </div>

      {/* Wrapper: a <table> ignores the 1px width of the visually-hidden pattern. */}
      <div className={styles.srOnly}>
        <table>
          <caption>Nombre de plongées par mois sur les 12 derniers mois</caption>
          <thead>
            <tr>
              <th scope="col">Mois</th>
              <th scope="col">Plongées</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month, index) => (
              <tr key={`${month.month}-${index}`}>
                <th scope="row">{month.month}</th>
                <td>{month.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}
