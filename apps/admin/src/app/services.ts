import { createBrowserRouter } from 'react-router';
import { createApiClient } from '@/shared/lib/apiClient';
import { env } from '@/shared/lib/env';
import { createSessionNavigation } from './access-control/sessionNavigation';
import { createRoutes } from './routes';

/**
 * The client of the pages (`ApiClientContext`): a `401` / `403` met by a call leads to `/login`
 * or `/forbidden`. The router is read once a call fails, long after both are built.
 */
export const apiClient = createApiClient({
  baseUrl: env.apiBaseUrl,
  onSessionError: createSessionNavigation(() => router),
});

/** The router, whose loaders and actions handle a `401` / `403` themselves. */
export const router = createBrowserRouter(
  createRoutes({ apiClient: createApiClient({ baseUrl: env.apiBaseUrl }) }),
);
