import { Suspense, useId, useState } from 'react';
import { useApiClient } from '@/shared/hooks/useApiClient';
import { ApiError } from '@/shared/lib/apiClient';
import { createPromiseCache } from '@/shared/lib/promiseCache';
import { Button } from '@/shared/ui/Button';
import { ErrorBoundary, type ErrorFallbackProps } from '@/shared/ui/ErrorBoundary';
import { fetchHealth } from '../api/healthApi';
import { HealthStatus } from './HealthStatus';
import styles from './HealthPanel.module.scss';

/** API health card: owns the data cache and the loading / error states around HealthStatus. */
export function HealthPanel() {
  const client = useApiClient();
  // Lazy cache: creating it does not fetch, so a double initializer call (StrictMode) is harmless.
  const [healthCache] = useState(() => createPromiseCache(() => fetchHealth(client)));
  const titleId = useId();

  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <h2 id={titleId} className={styles.title}>
        API status
      </h2>
      <ErrorBoundary
        fallback={(props) => <HealthError {...props} />}
        onReset={() => void healthCache.reload()}
      >
        <Suspense fallback={<HealthLoading />}>
          <HealthStatus cache={healthCache} />
        </Suspense>
      </ErrorBoundary>
    </section>
  );
}

function HealthLoading() {
  return (
    <p role="status" className={styles.message}>
      Checking the API…
    </p>
  );
}

function HealthError({ error, reset }: ErrorFallbackProps) {
  const reason = error instanceof ApiError ? error.message : 'An unexpected error occurred.';

  return (
    <div className={styles.error}>
      <p role="alert" className={styles.message}>
        Unable to get the API status. {reason}
      </p>
      <Button onClick={reset}>Retry</Button>
    </div>
  );
}
