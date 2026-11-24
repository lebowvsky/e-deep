// The app's single instances (module level: one per page load, never recreated by a render). The
// tests build their own (`@/test/TestProviders`, `createRoutes`) and never import this module.
import { createBrowserRouter } from 'react-router';
import { createApiClient } from '@/shared/lib/apiClient';
import { env } from '@/shared/lib/env';
import { createHttpAuthClient } from '@/shared/session/api/httpAuthClient';
import { createAuthBroadcast } from '@/shared/session/lib/authBroadcast';
import { createHttpSitesRepository } from '@/shared/sites/api/httpSitesRepository';
import { createAppSession } from './appSession';
import { lazyAuthClient } from './lazyAuthClient';
import { createRoutes } from './routes';

export const apiClient = createApiClient({ baseUrl: env.apiBaseUrl });
export const sitesRepository = createHttpSitesRepository(apiClient);

/**
 * Development only: a page opened with `?state=…` (comparison with the mockups, screenshots) gets
 * the in-memory fake session, so that it renders without the API. `import.meta.env.DEV` is false
 * in production: the whole branch, and the import of the fake with it, is dropped from the bundle.
 */
const authClient =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('state')
    ? lazyAuthClient(async () =>
        (await import('@/shared/session/mocks/fakeAuthClient')).createFakeAuthClient(),
      )
    : createHttpAuthClient(apiClient);

const session = createAppSession({
  authClient,
  broadcast: createAuthBroadcast(),
  getRouter: () => router,
});

export const queryClient = session.queryClient;
export const authServices = session.authServices;

/** React Router in data mode (D20); the loaders read the session through the same cache. */
export const router = createBrowserRouter(createRoutes({ queryClient, authClient }));
