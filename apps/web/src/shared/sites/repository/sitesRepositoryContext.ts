import { createContext } from 'react';
import type { SitesRepository } from './sitesRepository';

/** Injected like the API client: the tests give their own (`TestProviders`). */
export const SitesRepositoryContext = createContext<SitesRepository | null>(null);
