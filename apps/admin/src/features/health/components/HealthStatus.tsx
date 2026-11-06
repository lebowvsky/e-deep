import type { DependencyStatus, HealthResponse, HealthStatus as ApiStatus } from '@e-deep/shared';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import type { PromiseCache } from '@/shared/lib/promiseCache';
import { useHealth } from '../hooks/useHealth';
import { StatusBadge, type StatusTone } from './StatusBadge';

const STATUS_DISPLAY = {
  ok: { label: 'Operational', tone: 'success' },
  degraded: { label: 'Degraded', tone: 'warning' },
} as const satisfies Record<ApiStatus, { label: string; tone: StatusTone }>;

const DATABASE_DISPLAY = {
  up: { label: 'Up', tone: 'success' },
  down: { label: 'Down', tone: 'danger' },
} as const satisfies Record<DependencyStatus, { label: string; tone: StatusTone }>;

const timeFormatter = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' });

interface HealthStatusProps {
  cache: PromiseCache<HealthResponse>;
}

/** Renders the last API health check. Suspends while the first check is pending. */
export function HealthStatus({ cache }: HealthStatusProps) {
  const { health, isRefreshing, refresh } = useHealth(cache);
  const status = STATUS_DISPLAY[health.status];
  const database = DATABASE_DISPLAY[health.database];

  return (
    <>
      <CardContent aria-busy={isRefreshing}>
        <div role="status">
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3">
            <dt className="text-muted-foreground">API</dt>
            <dd className="justify-self-end">
              <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            </dd>
            <dt className="text-muted-foreground">Database</dt>
            <dd className="justify-self-end">
              <StatusBadge tone={database.tone}>{database.label}</StatusBadge>
            </dd>
            <dt className="text-muted-foreground">Checked at</dt>
            <dd className="justify-self-end tabular-nums">
              <time dateTime={health.timestamp}>
                {timeFormatter.format(new Date(health.timestamp))}
              </time>
            </dd>
          </dl>
        </div>
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          variant="outline"
          size="lg"
          className="h-11 sm:h-9"
          onClick={refresh}
          aria-busy={isRefreshing}
        >
          {isRefreshing ? 'Refreshing…' : 'Refresh'}
        </Button>
      </CardFooter>
    </>
  );
}
