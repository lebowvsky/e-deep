import type { ReactNode } from 'react';
import { createApiClient } from '@/shared/lib/apiClient';
import { ApiClientContext } from '@/shared/lib/apiClientContext';
import { env } from '@/shared/lib/env';
import { ToastProvider } from '@/shared/ui/Toast';

const apiClient = createApiClient({ baseUrl: env.apiBaseUrl });

/** App-wide dependencies. Tests provide their own instead of rendering this component. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ApiClientContext value={apiClient}>
      <ToastProvider>{children}</ToastProvider>
    </ApiClientContext>
  );
}
