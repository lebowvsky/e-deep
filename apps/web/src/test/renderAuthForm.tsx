import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { appConfig, type AppConfig } from '@/shared/config/app';
import type { AuthClient } from '@/shared/session/authClient';
import { createAuthBroadcast } from '@/shared/session/lib/authBroadcast';
import { createFakeAuthClient } from '@/shared/session/mocks/fakeAuthClient';
import { fakeApiClient } from './fakeApiClient';
import { EmailHolder, type EmailProps } from './EmailHolder';
import { createTestQueryClient } from './queryClient';
import { TestProviders } from './TestProviders';

export interface RenderAuthFormOptions {
  /** No session, the sign-up open, by default. */
  authClient?: AuthClient;
  signup?: boolean;
}

const landing = (title: string) => ({ element: <h1>{title}</h1> });

/**
 * An auth form (or card) at `path`, in a data router whose other pages are titles only: `/stats`,
 * `/dashboard`, `/welcome`, `/forgot-password`. `form` is rendered on `/login` and `/signup`.
 */
export function renderAuthForm(
  path: string,
  form: (props: EmailProps) => ReactNode,
  {
    authClient = createFakeAuthClient({ session: null }),
    signup = true,
  }: RenderAuthFormOptions = {},
) {
  const queryClient = createTestQueryClient();
  const config: AppConfig = { ...appConfig, features: { ...appConfig.features, signup } };
  const router = createMemoryRouter(
    [
      {
        // One element for both, as in the app: the e-mail survives from one to the other.
        element: <EmailHolder render={form} />,
        children: [{ path: '/login' }, { path: '/signup' }],
      },
      { path: '/stats', ...landing('Statistiques') },
      { path: '/dashboard', ...landing('Tableau de bord') },
      { path: '/welcome', ...landing('Bienvenue') },
      { path: '/forgot-password', ...landing('Mot de passe oublié') },
    ],
    { initialEntries: [path] },
  );
  render(
    <TestProviders
      client={fakeApiClient({})}
      queryClient={queryClient}
      config={config}
      me={null}
      authServices={{
        authClient,
        broadcast: createAuthBroadcast(() => null),
        purgeDeviceData: () => undefined,
      }}
    >
      <RouterProvider router={router} />
    </TestProviders>,
  );
  return { router, queryClient, authClient };
}
