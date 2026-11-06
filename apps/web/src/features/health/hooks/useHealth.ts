import { use, useState, useTransition } from 'react';
import type { HealthResponse } from '@e-deep/shared';
import type { PromiseCache } from '@/shared/lib/promiseCache';

export interface UseHealthResult {
  health: HealthResponse;
  /** True while a refresh is in flight; the previous result stays on screen meanwhile. */
  isRefreshing: boolean;
  refresh: () => void;
}

/**
 * Reads the API health from `cache`. Suspends on the first load and throws on failure,
 * so it must be rendered under `<Suspense>` and an error boundary.
 */
export function useHealth(cache: PromiseCache<HealthResponse>): UseHealthResult {
  // The cache returns the same promise when React retries a suspended render.
  const [healthPromise, setHealthPromise] = useState(() => cache.read());
  const [isRefreshing, startTransition] = useTransition();
  const health = use(healthPromise);

  function refresh() {
    // A transition keeps the current result visible instead of falling back to the Suspense UI.
    startTransition(() => {
      setHealthPromise(cache.reload());
    });
  }

  return { health, isRefreshing, refresh };
}
