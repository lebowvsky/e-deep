import { Card } from '@/shared/ui/Card';
import { Skeleton } from '@/shared/ui/Skeleton';
import styles from './DivesSkeleton.module.scss';

const SUMMARY_ITEMS = 5;
const ROWS = 6;
const CARDS = 3;
/** Cells of a table row, in the column order of the table. */
const CELLS = ['number', 'date', 'site', 'depth', 'duration', 'temp', 'gas', 'team'] as const;

/**
 * Loading state: summary band and 6 ghost rows on the grid of the table (cards below 1024px).
 * The page header stays real; `aria-busy` marks the loading part, the page live region (outside
 * it, as a busy container can silence it) announces the loading.
 */
export function DivesSkeleton() {
  return (
    <div className={styles.skeleton} aria-busy="true">
      <Skeleton shape="control" className={styles.search} />
      <div className={styles.band} aria-hidden="true">
        {Array.from({ length: SUMMARY_ITEMS }, (_unused, index) => (
          <div key={index} className={styles.bandItem}>
            <Skeleton className={styles.label} />
            <Skeleton shape="block" className={styles.value} />
          </div>
        ))}
      </div>
      <Card padding="none" className={styles.table} aria-hidden="true">
        <div className={styles.head} />
        {Array.from({ length: ROWS }, (_unused, row) => (
          <div key={row} className={styles.row}>
            {CELLS.map((cell) => (
              <Skeleton key={cell} className={styles[cell]} />
            ))}
          </div>
        ))}
      </Card>
      <div className={styles.cards} aria-hidden="true">
        {Array.from({ length: CARDS }, (_unused, index) => (
          <Card key={index} padding="none" className={styles.card}>
            <Skeleton className={styles.label} />
            <Skeleton shape="block" className={styles.cardTitle} />
            <Skeleton className={styles.cardMeasures} />
          </Card>
        ))}
      </div>
    </div>
  );
}
