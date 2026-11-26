import { use, useState, type ReactNode } from 'react';
import { useApiClient } from '@/shared/hooks/useApiClient';
import { createHttpSitesRepository } from '../api/httpSitesRepository';
import { SitesRepositoryContext } from './sitesRepositoryContext';

/**
 * Gives the screens of the signed-in app their `SitesRepository`: the one injected above (the
 * tests), or one over the API client. Mounted by the app frame (`AppShell`, a lazy route), so that
 * the sites code is not in the bundle of the public pages (D45).
 */
export function SitesRepositoryScope({ children }: { children: ReactNode }) {
  const injected = use(SitesRepositoryContext);
  const apiClient = useApiClient();
  const [repository] = useState(() => injected ?? createHttpSitesRepository(apiClient));
  return <SitesRepositoryContext value={repository}>{children}</SitesRepositoryContext>;
}
