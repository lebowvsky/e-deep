import type { MeResponse } from '@e-deep/shared';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { appConfig, type AppConfig } from '@/shared/config/app';
import { AppConfigContext } from '@/shared/config/appConfigContext';
import type { ApiClient } from '@/shared/lib/apiClient';
import { ApiClientContext } from '@/shared/lib/apiClientContext';
import { sessionKeys } from '@/shared/session/api/meApi';
import type { AuthClient } from '@/shared/session/authClient';
import { AuthServicesContext, type AuthServices } from '@/shared/session/authServices';
import { createAuthBroadcast } from '@/shared/session/lib/authBroadcast';
import { createFakeAuthClient } from '@/shared/session/mocks/fakeAuthClient';
import { ME_FIXTURE } from '@/shared/session/mocks/me';
import { createMemorySitesRepository } from '@/shared/sites/mocks/memorySitesRepository';
import type { SitesRepository } from '@/shared/sites/repository/sitesRepository';
import { SitesRepositoryContext } from '@/shared/sites/repository/sitesRepositoryContext';
import { createTestQueryClient } from './queryClient';

export interface TestProvidersProps {
  /** Fake API client (`{ get: vi.fn()… }`): tests never reach the network. */
  client: ApiClient;
  /** The sites (`/api/sites`); an empty in-memory repository per render by default. */
  sitesRepository?: SitesRepository;
  /**
   * The signed-in diver, put in the cache as the `requireSession` loader would (`ME_FIXTURE` by
   * default, a complete profile); `null` leaves the cache without a session.
   */
  me?: MeResponse | null;
  /** The auth port; an in-memory fake signed in as `me` by default. */
  authClient?: AuthClient;
  /** The whole auth services (the app's wiring, `createAppSession`); `authClient` is ignored then. */
  authServices?: AuthServices;
  /** Shared with a router built by `createRoutes`, so that its loaders read the same cache. */
  queryClient?: QueryClient;
  /** The product configuration (`features`, `privacy`); the real one by default. */
  config?: AppConfig;
  children: ReactNode;
}

/**
 * The data dependencies of `AppProviders`, isolated per test: a fresh query cache for every
 * render (no state leaks between tests), the session of `me` already in it.
 */
export function TestProviders({
  client,
  sitesRepository,
  me = ME_FIXTURE,
  authClient,
  authServices: givenAuthServices,
  queryClient: givenQueryClient,
  config = appConfig,
  children,
}: TestProvidersProps) {
  const [defaultSitesRepository] = useState(() => createMemorySitesRepository());
  const [queryClient] = useState(() => {
    const cache = givenQueryClient ?? createTestQueryClient();
    if (me !== null) cache.setQueryData(sessionKeys.me(), me);
    return cache;
  });
  const [authServices] = useState<AuthServices>(
    () =>
      givenAuthServices ?? {
        authClient: authClient ?? createFakeAuthClient({ session: me }),
        // No channel: a test never talks to other tabs.
        broadcast: createAuthBroadcast(() => null),
        purgeDeviceData: () => undefined,
        onSessionLost: () => undefined,
      },
  );
  return (
    <AppConfigContext value={config}>
      <ApiClientContext value={client}>
        <AuthServicesContext value={authServices}>
          <SitesRepositoryContext value={sitesRepository ?? defaultSitesRepository}>
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
          </SitesRepositoryContext>
        </AuthServicesContext>
      </ApiClientContext>
    </AppConfigContext>
  );
}
