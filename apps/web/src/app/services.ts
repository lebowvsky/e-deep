// The app's single instances (module level: one per page load, never recreated by a render). The
// tests build their own (`@/test/TestProviders`, `createRoutes`) and never import this module.
import { createBrowserRouter } from 'react-router';
import { appConfig as productConfig } from '@/shared/config/app';
import { createApiClient } from '@/shared/lib/apiClient';
import { env } from '@/shared/lib/env';
import { createHttpAuthClient } from '@/shared/session/api/httpAuthClient';
import { createAuthBroadcast } from '@/shared/session/lib/authBroadcast';
import { createAppSession } from './appSession';
import { devAppConfig, devAuthOptions } from './devState';
import { lazyAuthClient } from './lazyAuthClient';
import { createRoutes } from './routes';

export const apiClient = createApiClient({ baseUrl: env.apiBaseUrl });

/**
 * Development only: a page opened with `?state=…` (comparison with the mockups, screenshots) gets
 * the in-memory fake session (`devState.ts`), so that it renders without the API. Every use below
 * starts with `import.meta.env.DEV`, false in production: the branches, the import of the fake
 * with them, are dropped from the bundle.
 */
const devState = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('state')
  : null;

const authClient =
  import.meta.env.DEV && devState !== null
    ? lazyAuthClient(async () =>
        (await import('@/shared/session/mocks/fakeAuthClient')).createFakeAuthClient(
          await devAuthOptions(devState),
        ),
      )
    : createHttpAuthClient(apiClient);

/** The product configuration (`features`, `privacy`); `?state=guest-signup` opens the sign-up. */
export const appConfig =
  import.meta.env.DEV && devState !== null ? devAppConfig(devState) : productConfig;

const session = createAppSession({
  authClient,
  broadcast: createAuthBroadcast(),
  getRouter: () => router,
});

export const queryClient = session.queryClient;
export const authServices = session.authServices;

/** React Router in data mode (D20); the loaders read the session through the same cache. */
export const router = createBrowserRouter(
  createRoutes({ queryClient, authServices, features: appConfig.features }),
);
