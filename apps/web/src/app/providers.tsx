import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createApiClient } from '@/shared/lib/apiClient';
import { ApiClientContext } from '@/shared/lib/apiClientContext';
import { env } from '@/shared/lib/env';
import { createQueryClient } from '@/shared/lib/queryClient';
import { ToastProvider } from '@/shared/ui/Toast';

const apiClient = createApiClient({ baseUrl: env.apiBaseUrl });
// Module level: one cache for the whole app session, never recreated by a re-render.
const queryClient = createQueryClient();

/** App-wide dependencies. Tests provide their own (`@/test/TestProviders`) instead. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ApiClientContext value={apiClient}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </ApiClientContext>
  );
}
