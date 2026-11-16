import { Skeleton } from '@/shared/ui/Skeleton';
import type { LoggedDive } from '../../../types';
import { DiveDetailHeader } from '../DiveDetailHeader';
import styles from './DiveDetailSkeleton.module.scss';

export interface DiveDetailSkeletonProps {
  /** The dive as the cached log knows it: its header is shown for real at once. */
  preview: LoggedDive | null;
}

const KPI_COUNT = 4;

/**
 * Loading state: header, 4 KPI, run card and side column. `aria-busy` marks the loading part; the
 * page live region (outside it) announces the loading.
 */
export function DiveDetailSkeleton({ preview }: DiveDetailSkeletonProps) {
  return (
    <div className={styles.skeleton} aria-busy="true">
      {preview ? (
        <DiveDetailHeader dive={preview} stopsOk={null} />
      ) : (
        <div className={styles.header} aria-hidden="true">
          <Skeleton className={styles.overline} />
          <Skeleton shape="block" className={styles.title} />
          <Skeleton className={styles.place} />
        </div>
      )}
      <div className={styles.kpis} aria-hidden="true">
        {Array.from({ length: KPI_COUNT }, (_unused, index) => (
          <div key={index} className={styles.kpi}>
            <Skeleton className={styles.label} />
            <Skeleton shape="block" className={styles.value} />
          </div>
        ))}
      </div>
      <div className={styles.layout} aria-hidden="true">
        <div className={styles.card}>
          <Skeleton className={styles.label} />
          <Skeleton shape="block" className={styles.value} />
          <Skeleton className={styles.bar} />
        </div>
        <div className={styles.side}>
          <div className={styles.card}>
            <Skeleton className={styles.label} />
            <Skeleton shape="block" className={styles.map} />
          </div>
        </div>
      </div>
    </div>
  );
}
