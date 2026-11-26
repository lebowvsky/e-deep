import type { MeResponse } from '@e-deep/shared';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { AuthClient } from '@/shared/session/authClient';
import { createFakeAuthClient } from '@/shared/session/mocks/fakeAuthClient';
import { ME_FIXTURE } from '@/shared/session/mocks/me';
import { ToastProvider } from '@/shared/ui/Toast';
import { testAuthServices } from './appRouter';
import { fakeApiClient } from './fakeApiClient';
import { LandingProbe } from './LandingProbe';
import { createTestQueryClient } from './queryClient';
import { TestProviders } from './TestProviders';

export interface RenderAccountScreenOptions {
  /** The session in the cache and in the fake: the complete `ME_FIXTURE` by default. */
  session?: MeResponse;
  /** The auth port; a fake signed in as `session` by default. */
  authClient?: AuthClient;
}

const titled = (title: string) => ({ element: <h1>{title}</h1> });

/**
 * An account screen (an onboarding form, a part of `/settings`) at `path`, signed in, in a data
 * router whose other pages are titles only: `/` (with the notice of its route state), `/dashboard`,
 * `/stats`, `/welcome` and `/consent`.
 */
export function renderAccountScreen(
  path: string,
  screen: ReactNode,
  {
    session = ME_FIXTURE,
    authClient = createFakeAuthClient({ session }),
  }: RenderAccountScreenOptions = {},
) {
  const queryClient = createTestQueryClient();
  const { pathname } = new URL(path, 'http://app.test');
  const router = createMemoryRouter(
    [
      { path: pathname, element: screen },
      { path: '/', element: <LandingProbe /> },
      { path: '/dashboard', ...titled('Tableau de bord') },
      { path: '/stats', ...titled('Statistiques') },
      { path: '/welcome', ...titled('Bienvenue') },
      { path: '/consent', ...titled('Consentement') },
    ],
    { initialEntries: [path] },
  );
  const authServices = testAuthServices(authClient);
  render(
    <TestProviders
      client={fakeApiClient({})}
      queryClient={queryClient}
      me={session}
      authServices={authServices}
    >
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </TestProviders>,
  );
  return { router, queryClient, authClient };
}
