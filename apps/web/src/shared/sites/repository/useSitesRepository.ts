import { use } from 'react';
import type { SitesRepository } from './sitesRepository';
import { SitesRepositoryContext } from './sitesRepositoryContext';

export function useSitesRepository(): SitesRepository {
  const repository = use(SitesRepositoryContext);
  if (!repository) {
    throw new Error('useSitesRepository must be used inside <SitesRepositoryContext value={…}>.');
  }
  return repository;
}
