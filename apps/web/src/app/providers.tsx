import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiClientContext } from '@/shared/lib/apiClientContext';
import { AuthServicesContext } from '@/shared/session/authServices';
import { SitesRepositoryContext } from '@/shared/sites/repository/sitesRepositoryContext';
import { ToastProvider } from '@/shared/ui/Toast';
import { apiClient, authServices, queryClient, sitesRepository } from './services';

/** App-wide dependencies. Tests provide their own (`@/test/TestProviders`) instead. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ApiClientContext value={apiClient}>
      <AuthServicesContext value={authServices}>
        <SitesRepositoryContext value={sitesRepository}>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>{children}</ToastProvider>
          </QueryClientProvider>
        </SitesRepositoryContext>
      </AuthServicesContext>
    </ApiClientContext>
  );
}
