import { Navigate, type RouteObject } from 'react-router';
import { redirectIfAuthenticated } from '@/shared/session/lib/redirectIfAuthenticated';
import { requireOnboardingStep, requireSession } from '@/shared/session/lib/requireSession';
import type { SessionLoaderDependencies } from '@/shared/session/lib/loadSession';
import { AppShell } from './layout/AppShell';
import type { AppRouteHandle } from './layout/routeHandle';
import { DashboardPage } from './routes/DashboardPage';
import { DiveDetailPage } from './routes/DiveDetailPage';
import { DivesPage } from './routes/DivesPage';
import { HomePage } from './routes/HomePage';
import { PlaceholderPage } from './routes/PlaceholderPage';
import { RouteErrorPage } from './routes/RouteErrorPage';
import { SessionPending } from './routes/SessionPending';

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

const placeholder = (path: string, title: string): RouteObject => ({
  path,
  element: <PlaceholderPage title={title} />,
});

/** A placeholder outside the app frame (no shell): its own `main`. */
const standalone = (title: string, message: string) => (
  <main id="main-content">
    <PlaceholderPage title={title} message={message} />
  </main>
);

export type RouteDependencies = SessionLoaderDependencies;

/**
 * The route table (React Router data mode, D20). The session loaders (D41) get the query client and
 * the auth client injected: the app passes its own, the tests theirs.
 */
export function createRoutes(dependencies: RouteDependencies): RouteObject[] {
  return [
    // The landing page arrives with the public pages (lot 6).
    { index: true, element: <Navigate to="/dashboard" replace /> },
    // Public: a signed-in diver goes on to `next`. The real page arrives at lot 6.
    {
      path: '/login',
      loader: redirectIfAuthenticated(dependencies),
      HydrateFallback: SessionPending,
      errorElement: <RouteErrorPage />,
      element: standalone('Connexion', 'La page de connexion arrive bientôt.'),
    },
    // Onboarding (D38): a session is needed, a complete profile is not. Real pages at lot 6.
    {
      path: '/welcome',
      loader: requireOnboardingStep(dependencies, 'profile-required'),
      HydrateFallback: SessionPending,
      errorElement: <RouteErrorPage />,
      element: standalone('Bienvenue', 'Le premier lancement de ton carnet arrive bientôt.'),
    },
    {
      path: '/consent',
      loader: requireOnboardingStep(dependencies, 'consent-required'),
      HydrateFallback: SessionPending,
      errorElement: <RouteErrorPage />,
      element: standalone('Consentement', 'Le renouvellement de ton consentement arrive bientôt.'),
    },
    {
      // The app: a session and a complete profile, or a redirect (`requireSession`).
      loader: requireSession(dependencies),
      HydrateFallback: SessionPending,
      errorElement: <RouteErrorPage />,
      element: <AppShell />,
      children: [
        { path: '/dashboard', element: <DashboardPage /> },
        { path: '/dives', element: <DivesPage /> },
        // Also `/dives/new?from=:id` (duplicate); the static segment wins over `:diveId`.
        { path: '/dives/new', lazy: lazyDiveForm, handle: diveFormHandle },
        { path: '/dives/:diveId', element: <DiveDetailPage /> },
        { path: '/dives/:diveId/edit', lazy: lazyDiveForm, handle: diveFormHandle },
        { path: '/map', lazy: lazyMap, handle: mapHandle },
        { path: '/sites/:siteId', lazy: lazySiteDetail, handle: siteDetailHandle },
        placeholder('/stats', 'Statistiques'),
        placeholder('/buddies', 'Binômes'),
        placeholder('/search', 'Recherche'),
        placeholder('/notifications', 'Notifications'),
        placeholder('/settings', 'Paramètres'),
        placeholder('/logout', 'Déconnexion'),
        {
          path: '*',
          element: <PlaceholderPage title="Page introuvable" message="Cette page n’existe pas." />,
        },
      ],
    },
    // Technical page: API health (outside the app frame).
    { path: '/status', element: <HomePage /> },
    ...devRoutes,
  ];
}
