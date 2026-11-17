import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './DiveFormSkeleton.module.scss';

export interface DiveFormSkeletonProps {
  /** h1 of the page while it loads (« Nouvelle plongée »), for screen readers. */
  title: string;
}

const SECTION_COUNT = 2;

/** Loading state of the form: title block and the first sections. `aria-busy` while it loads. */
export function DiveFormSkeleton({ title }: DiveFormSkeletonProps) {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <h1 className={styles.srOnly}>{title}</h1>
      <div className={styles.header} aria-hidden="true">
        <Skeleton className={styles.overline} />
        <Skeleton shape="block" className={styles.title} />
        <Skeleton className={styles.subtitle} />
      </div>
      {Array.from({ length: SECTION_COUNT }, (_unused, index) => (
        <div key={index} className={styles.section} aria-hidden="true">
          <Skeleton className={styles.overline} />
          <Skeleton shape="control" className={styles.field} />
          <Skeleton shape="control" className={styles.field} />
        </div>
      ))}
    </div>
  );
}
