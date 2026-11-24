import type { MeResponse } from '@e-deep/shared';
import { render } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { vi } from 'vitest';
import { appConfig, type AppConfig } from '@/shared/config/app';
import { createFakeAuthClient } from '@/shared/session/mocks/fakeAuthClient';
import { ToastProvider } from '@/shared/ui/Toast';
import { createTestAppRouter } from './appRouter';
import { fakeApiClient } from './fakeApiClient';
import { TestProviders } from './TestProviders';

export interface RenderPublicRouteOptions {
  /** No session by default: these are the visitor's pages. */
  session?: MeResponse | null;
  /** The product configuration: the sign-up open, the rest as in the app. */
  signup?: boolean;
  offline?: boolean;
  privacyCopy?: string | null;
}

/** The app's routes at `path`, for a visitor by default, with the given product configuration. */
export function renderPublicRoute(
  path: string,
  {
    session = null,
    signup = true,
    offline = appConfig.features.offline,
    privacyCopy = appConfig.privacy.copy,
  }: RenderPublicRouteOptions = {},
) {
  const config: AppConfig = { features: { signup, offline }, privacy: { copy: privacyCopy } };
  const { router, queryClient, authServices } = createTestAppRouter(path, {
    authClient: createFakeAuthClient({ session }),
    features: config.features,
  });
  render(
    <TestProviders
      client={fakeApiClient({ get: vi.fn(() => new Promise<never>(() => undefined)) })}
      queryClient={queryClient}
      authServices={authServices}
      config={config}
      me={null}
    >
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </TestProviders>,
  );
  return router;
}

/** jsdom has no `matchMedia`: a ≥ 1024px viewport (every query matches). Phones: no stub. */
export function stubDesktop() {
  vi.stubGlobal('matchMedia', (query: string): Partial<MediaQueryList> => ({
    matches: true,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}
