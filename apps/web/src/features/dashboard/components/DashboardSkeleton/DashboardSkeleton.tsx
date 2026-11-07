import type { CSSProperties } from 'react';
import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './DashboardSkeleton.module.scss';

// Decorative layout of the placeholders (dashboard-states.jsx · LoadingDesktop).
const MARKERS = [
  [20, 30],
  [35, 50],
  [48, 42],
  [60, 55],
  [70, 48],
  [80, 62],
] as const;
const BARS = [40, 60, 80, 95, 70, 45, 30, 20, 35, 50, 55, 65] as const;
const FILTERS = 4;

const position = ([x, y]: readonly [number, number]) =>
  ({ '--x': `${x}%`, '--y': `${y}%` }) as CSSProperties;

/** Loading state (mockup 03): same structure as the nominal dashboard, shimmering placeholders. */
export function DashboardSkeleton() {
  return (
    <div className={styles.dashboard} aria-busy="true">
      <h1 className={styles.srOnly}>Tableau de bord</h1>
      <p className={styles.srOnly} role="status">
        Chargement du tableau de bord
      </p>

      <div className={styles.header} aria-hidden="true">
        <div className={styles.headerText}>
          <Skeleton className={styles.overline} />
          <Skeleton shape="block" className={styles.title} />
          <Skeleton className={styles.subtitle} />
        </div>
        <div className={styles.actions}>
          <Skeleton shape="control" className={styles.iconAction} />
          <Skeleton shape="control" className={styles.iconAction} />
          <Skeleton shape="control" className={styles.cta} />
        </div>
      </div>

      <ul className={styles.kpis} aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <li key={index} className={styles.kpi}>
            <Skeleton className={styles.kpiLabel} />
            <div className={styles.kpiBody}>
              <Skeleton shape="block" className={styles.kpiValue} />
              <Skeleton className={styles.kpiCaption} />
            </div>
          </li>
        ))}
      </ul>

      <div className={styles.map} aria-hidden="true">
        <div className={styles.mapHeader}>
          <div className={styles.mapHeading}>
            <Skeleton className={styles.mapOverline} />
            <Skeleton shape="block" className={styles.mapTitle} />
          </div>
          <div className={styles.filters}>
            {Array.from({ length: FILTERS }, (_, index) => (
              <Skeleton key={index} shape="block" className={styles.filter} />
            ))}
          </div>
        </div>
        <div className={styles.mapCanvas}>
          <Skeleton shape="control" className={styles.mapFill} />
          {MARKERS.map((marker) => (
            <span key={marker.join('-')} className={styles.marker} style={position(marker)} />
          ))}
        </div>
      </div>

      <div className={styles.pair} aria-hidden="true">
        <div className={styles.card}>
          <Skeleton className={styles.cardOverline} />
          <Skeleton shape="block" className={styles.cardTitle} />
          <Skeleton className={styles.cardSubtitle} />
          <div className={styles.metrics}>
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className={styles.metric}>
                <Skeleton className={styles.metricLabel} />
                <Skeleton shape="block" className={styles.metricValue} />
              </div>
            ))}
          </div>
        </div>
        <div className={styles.card}>
          <Skeleton className={styles.cardOverline} />
          <Skeleton shape="block" className={styles.cardTitle} />
          <div className={styles.bars}>
            {BARS.map((height, index) => (
              // Decorative bar height (inline, like the real chart).
              <span key={index} className={styles.barSlot} style={{ height: `${height}%` }}>
                <Skeleton className={styles.bar} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
