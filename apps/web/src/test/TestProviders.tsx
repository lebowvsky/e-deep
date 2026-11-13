import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import type { ApiClient } from '@/shared/lib/apiClient';
import { ApiClientContext } from '@/shared/lib/apiClientContext';

export interface TestProvidersProps {
  /** Fake API client (`{ get: vi.fn()… }`): tests never reach the network. */
  client: ApiClient;
  children: ReactNode;
}

/**
 * The data dependencies of `AppProviders`, isolated per test: a fresh query cache for every
 * render (no state leaks between tests) and no retry, so a failure shows at once.
 */
export function TestProviders({ client, children }: TestProvidersProps) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } }),
  );
  return (
    <ApiClientContext value={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ApiClientContext>
  );
}
