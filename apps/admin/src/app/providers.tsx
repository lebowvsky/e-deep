import type { ReactNode } from 'react';
import { ApiClientContext } from '@/shared/lib/apiClientContext';
import { apiClient } from './services';

/** App-wide dependencies. Tests provide their own instead of rendering this component. */
export function AppProviders({ children }: { children: ReactNode }) {
  return <ApiClientContext value={apiClient}>{children}</ApiClientContext>;
}
