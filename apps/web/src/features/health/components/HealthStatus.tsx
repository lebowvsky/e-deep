import type { DependencyStatus, HealthResponse, HealthStatus as ApiStatus } from '@e-deep/shared';
import type { PromiseCache } from '@/shared/lib/promiseCache';
import { cx } from '@/shared/lib/classNames';
import { Button } from '@/shared/ui/Button';
import { useHealth } from '../hooks/useHealth';
import styles from './HealthStatus.module.scss';

const STATUS_LABELS = {
  ok: 'Operational',
  degraded: 'Degraded',
} as const satisfies Record<ApiStatus, string>;

const DATABASE_LABELS = {
  up: 'Up',
  down: 'Down',
} as const satisfies Record<DependencyStatus, string>;

const TONES = {
  ok: styles.ok,
  degraded: styles.warning,
  up: styles.ok,
  down: styles.danger,
} satisfies Record<ApiStatus | DependencyStatus, string | undefined>;

const timeFormatter = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });

interface HealthStatusProps {
  cache: PromiseCache<HealthResponse>;
}

/** Renders the last API health check. Suspends while the first check is pending. */
export function HealthStatus({ cache }: HealthStatusProps) {
  const { health, isRefreshing, refresh } = useHealth(cache);

  return (
    <div className={styles.status} aria-busy={isRefreshing}>
      <div role="status" className={styles.summary}>
        <dl className={styles.list}>
          <div className={styles.row}>
            <dt>API</dt>
            <dd className={cx(styles.badge, TONES[health.status])}>
              {STATUS_LABELS[health.status]}
            </dd>
          </div>
          <div className={styles.row}>
            <dt>Database</dt>
            <dd className={cx(styles.badge, TONES[health.database])}>
              {DATABASE_LABELS[health.database]}
            </dd>
          </div>
          <div className={styles.row}>
            <dt>Checked at</dt>
            <dd>
              <time dateTime={health.timestamp}>
                {timeFormatter.format(new Date(health.timestamp))}
              </time>
            </dd>
          </div>
        </dl>
      </div>
      <Button onClick={refresh} aria-busy={isRefreshing}>
        {isRefreshing ? 'Refreshing…' : 'Refresh'}
      </Button>
    </div>
  );
}
