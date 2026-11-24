import { QueryClient } from '@tanstack/react-query';

/** A fresh query cache: no retry, so a failure shows at once; nothing collected during a test. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}
