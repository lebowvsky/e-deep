import type { QueryClient } from '@tanstack/react-query';
import { createMemoryRouter } from 'react-router';
import { createRoutes } from '@/app/routes';
import type { AuthClient } from '@/shared/session/authClient';
import { createFakeAuthClient } from '@/shared/session/mocks/fakeAuthClient';
import { createTestQueryClient } from './queryClient';

export interface TestAppRouterOptions {
  /** The session the loaders find: signed in as `ME_FIXTURE` by default. */
  authClient?: AuthClient;
  queryClient?: QueryClient;
}

/**
 * The app's real route table (`createRoutes`, loaders included) in memory, at `path`. Render it in
 * `<TestProviders queryClient={queryClient} authClient={authClient}>`.
 */
export function createTestAppRouter(
  path: string,
  {
    authClient = createFakeAuthClient(),
    queryClient = createTestQueryClient(),
  }: TestAppRouterOptions = {},
) {
  const router = createMemoryRouter(createRoutes({ queryClient, authClient }), {
    initialEntries: [path],
  });
  return { router, queryClient, authClient };
}
