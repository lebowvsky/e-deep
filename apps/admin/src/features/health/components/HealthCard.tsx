import { Suspense, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useApiClient } from '@/shared/hooks/useApiClient';
import { ApiError } from '@/shared/lib/apiClient';
import { createPromiseCache } from '@/shared/lib/promiseCache';
import { ErrorBoundary, type ErrorFallbackProps } from '@/shared/ui/ErrorBoundary';
import { fetchHealth } from '../api/healthApi';
import { HealthStatus } from './HealthStatus';

/** API health card: owns the data cache and the loading / error states around HealthStatus. */
export function HealthCard() {
  const client = useApiClient();
  const titleId = useId();
  // Lazy cache: creating it does not fetch, so a double initializer call (StrictMode) is harmless.
  const [healthCache] = useState(() => createPromiseCache(() => fetchHealth(client)));

  return (
    <section aria-labelledby={titleId}>
      <Card className="h-full">
        <CardHeader>
          <CardTitle>
            <h2 id={titleId}>API status</h2>
          </CardTitle>
          <CardDescription>Health of the E-Deep API and its database.</CardDescription>
        </CardHeader>
        <ErrorBoundary
          fallback={(props) => <HealthError {...props} />}
          onReset={() => void healthCache.reload()}
        >
          <Suspense fallback={<HealthLoading />}>
            <HealthStatus cache={healthCache} />
          </Suspense>
        </ErrorBoundary>
      </Card>
    </section>
  );
}

function HealthLoading() {
  return (
    <CardContent>
      <p role="status" className="text-muted-foreground">
        Checking the API…
      </p>
    </CardContent>
  );
}

function HealthError({ error, reset }: ErrorFallbackProps) {
  const reason = error instanceof ApiError ? error.message : 'An unexpected error occurred.';

  return (
    <CardContent className="flex flex-col items-start gap-3">
      <p role="alert" className="text-destructive">
        Unable to get the API status. {reason}
      </p>
      <Button variant="outline" size="lg" className="h-11 sm:h-9" onClick={reset}>
        Retry
      </Button>
    </CardContent>
  );
}
