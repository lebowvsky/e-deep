import type { QueryClient } from '@tanstack/react-query';
import { createMemoryRouter } from 'react-router';
import { createRoutes } from '@/app/routes';
import type { FeatureFlags } from '@/shared/config/app';
import type { AuthClient } from '@/shared/session/authClient';
import type { AuthServices } from '@/shared/session/authServices';
import { createAuthBroadcast } from '@/shared/session/lib/authBroadcast';
import { createFakeAuthClient } from '@/shared/session/mocks/fakeAuthClient';
import { createTestQueryClient } from './queryClient';

export interface TestAppRouterOptions {
  /** The session the loaders find: signed in as `ME_FIXTURE` by default. */
  authClient?: AuthClient;
  /** The whole auth services (the app's wiring, `createAppSession`); `authClient` is ignored then. */
  authServices?: AuthServices;
  queryClient?: QueryClient;
  /** Sign-up open by default; `{ signup: false }` for the closed beta. */
  features?: Pick<FeatureFlags, 'signup'>;
}

/** Auth services around `authClient` that talk to no other tab and keep nothing on the device. */
export function testAuthServices(authClient: AuthClient): AuthServices {
  return {
    authClient,
    broadcast: createAuthBroadcast(() => null),
    purgeDeviceData: () => undefined,
    onSessionLost: () => undefined,
  };
}

/**
 * The app's real route table (`createRoutes`, loaders and actions included) in memory, at `path`.
 * Render it in `<TestProviders queryClient={queryClient} authServices={authServices}>`.
 */
export function createTestAppRouter(
  path: string,
  {
    authClient = createFakeAuthClient(),
    authServices = testAuthServices(authClient),
    queryClient = createTestQueryClient(),
    features = { signup: true },
  }: TestAppRouterOptions = {},
) {
  const router = createMemoryRouter(createRoutes({ queryClient, authServices, features }), {
    initialEntries: [path],
  });
  return { router, queryClient, authClient: authServices.authClient, authServices };
}
