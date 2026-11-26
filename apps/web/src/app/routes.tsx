import type { QueryClient } from '@tanstack/react-query';
import { Outlet, type RouteObject } from 'react-router';
import type { FeatureFlags } from '@/shared/config/app';
import { LEGAL_PAGES, BETA_CONTACT_MESSAGE } from '@/shared/config/publicPages';
import type { AuthServices } from '@/shared/session/authServices';
import type { SessionLoaderDependencies } from '@/shared/session/lib/loadSession';
import { redirectIfAuthenticated } from '@/shared/session/lib/redirectIfAuthenticated';
import { requireOnboardingStep, requireSession } from '@/shared/session/lib/requireSession';
import { requireSignupOpen } from '@/shared/session/lib/requireSignupOpen';
import { PublicLayout } from './layout/PublicLayout';
import type { AppRouteHandle } from './layout/routeHandle';
import { logoutAction, logoutLoader } from './logoutRoute';
import { ForgotPasswordPage } from './routes/ForgotPasswordPage';
import { HomePage } from './routes/HomePage';
import { LegalPlaceholderPage } from './routes/LegalPlaceholderPage';
import { PlaceholderPage } from './routes/PlaceholderPage';
import { RouteErrorPage } from './routes/RouteErrorPage';
import { SessionPending } from './routes/SessionPending';

// Only the public pages are in the entry bundle: every screen of the signed-in app (its frame
// included) is a `lazy` route, loaded once matched, in parallel with its session loader (D45).

// Dev-only catalogue: `import.meta.env.DEV` is false in prod, so Rolldown drops the import.
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/_dev/ui',
        lazy: async () => ({
          Component: (await import('./routes/dev/UiPreviewPage')).UiPreviewPage,
        }),
      },
    ]
  : [];

const lazyAppShell = async () => ({ Component: (await import('./layout/AppShell')).AppShell });
const lazyDashboard = async () => ({
  Component: (await import('./routes/DashboardPage')).DashboardPage,
});
const lazyDives = async () => ({ Component: (await import('./routes/DivesPage')).DivesPage });
const lazyDiveDetail = async () => ({
  Component: (await import('./routes/DiveDetailPage')).DiveDetailPage,
});

// The dive form is a large screen opened on demand: its own chunk, loaded when the route matches.
const lazyDiveForm = async () => ({
  Component: (await import('./routes/DiveFormPage')).DiveFormPage,
});
const diveFormHandle: AppRouteHandle = { ownMobileBars: true };

// The site page has its own phone top bar (« ‹ Carte » and « … »), and no FAB.
const lazySiteDetail = async () => ({
  Component: (await import('./routes/SiteDetailPage')).SiteDetailPage,
});
const siteDetailHandle: AppRouteHandle = { ownMobileBars: true, hideFab: true };

// The map page loads MapLibre: its own chunk, and MapLibre itself only once a map is shown.
const lazyMap = async () => ({
  Component: (await import('./routes/MapPage')).MapPage,
});
// Phones: the map under the top bar, edge to edge, with its own « + Site » (no FAB).
const mapHandle: AppRouteHandle = { hideFab: true, fullBleed: true };

// Account screens (D38): their own chunks, so that `/` loads none of them (D45).
const lazyWelcome = async () => ({ Component: (await import('./routes/WelcomePage')).WelcomePage });
const lazyConsent = async () => ({ Component: (await import('./routes/ConsentPage')).ConsentPage });
const lazySettings = async () => ({
  Component: (await import('./routes/SettingsPage')).SettingsPage,
});
// No « + » over the account forms: nothing to log from there.
const settingsHandle: AppRouteHandle = { hideFab: true };

// Technical page: API health (outside the app frame).
const lazyStatus = async () => ({ Component: (await import('./routes/StatusPage')).StatusPage });

const placeholder = (path: string, title: string): RouteObject => ({
  path,
  element: <PlaceholderPage title={title} />,
});

export interface RouteDependencies {
  queryClient: QueryClient;
  /** The session services of the hooks (the logout action needs all of them). */
  authServices: AuthServices;
  /** What the product offers today (`features.signup`: is `/signup` open). */
  features: Pick<FeatureFlags, 'signup'>;
}

/**
 * The route table (React Router data mode, D20). The session loaders and the logout action (D41)
 * get the query client and the auth services injected: the app passes its own, the tests theirs.
 */
export function createRoutes({
  queryClient,
  authServices,
  features,
}: RouteDependencies): RouteObject[] {
  const session: SessionLoaderDependencies = { queryClient, authClient: authServices.authClient };

  return [
    {
      // The public entry (D45): `/`, `/login` and `/signup` share one element, which stays mounted
      // from one to the other (the e-mail typed survives a change of tab). A signed-in diver goes
      // on to `next` or to their onboarding page.
      id: 'public-entry',
      loader: redirectIfAuthenticated(session),
      HydrateFallback: SessionPending,
      errorElement: <RouteErrorPage />,
      Component: HomePage,
      children: [
        { index: true },
        { path: '/login' },
        // Closed beta (D39): to `/login`, `next` kept.
        { path: '/signup', loader: requireSignupOpen(features) },
      ],
    },
    {
      // Public pages readable with or without a session (placeholders: a few lines each).
      element: (
        <PublicLayout>
          <Outlet />
        </PublicLayout>
      ),
      errorElement: <RouteErrorPage />,
      children: [
        { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ...LEGAL_PAGES.map(({ path, title }): RouteObject => ({
          path,
          element:
            path === '/contact' ? (
              <LegalPlaceholderPage title={title} message={BETA_CONTACT_MESSAGE} />
            ) : (
              <LegalPlaceholderPage title={title} />
            ),
        })),
      ],
    },
    // Sign-out (D41): a form posts here (`UserCard`); a plain visit signs nobody out.
    {
      path: '/logout',
      loader: logoutLoader,
      action: logoutAction({ authServices, queryClient }),
      errorElement: <RouteErrorPage />,
    },
    // Onboarding (D38): a session is needed, a complete profile is not.
    {
      path: '/welcome',
      loader: requireOnboardingStep(session, 'profile-required'),
      HydrateFallback: SessionPending,
      errorElement: <RouteErrorPage />,
      lazy: lazyWelcome,
    },
    {
      path: '/consent',
      loader: requireOnboardingStep(session, 'consent-required'),
      HydrateFallback: SessionPending,
      errorElement: <RouteErrorPage />,
      lazy: lazyConsent,
    },
    {
      // The app: a session and a complete profile, or a redirect (`requireSession`).
      loader: requireSession(session),
      HydrateFallback: SessionPending,
      errorElement: <RouteErrorPage />,
      lazy: lazyAppShell,
      children: [
        { path: '/dashboard', lazy: lazyDashboard },
        { path: '/dives', lazy: lazyDives },
        // Also `/dives/new?from=:id` (duplicate); the static segment wins over `:diveId`.
        { path: '/dives/new', lazy: lazyDiveForm, handle: diveFormHandle },
        { path: '/dives/:diveId', lazy: lazyDiveDetail },
        { path: '/dives/:diveId/edit', lazy: lazyDiveForm, handle: diveFormHandle },
        { path: '/map', lazy: lazyMap, handle: mapHandle },
        { path: '/sites/:siteId', lazy: lazySiteDetail, handle: siteDetailHandle },
        placeholder('/stats', 'Statistiques'),
        placeholder('/buddies', 'Binômes'),
        placeholder('/search', 'Recherche'),
        placeholder('/notifications', 'Notifications'),
        { path: '/settings', lazy: lazySettings, handle: settingsHandle },
        {
          path: '*',
          element: <PlaceholderPage title="Page introuvable" message="Cette page n’existe pas." />,
        },
      ],
    },
    { path: '/status', lazy: lazyStatus },
    ...devRoutes,
  ];
}
