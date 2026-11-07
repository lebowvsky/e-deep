import { Navigate, type RouteObject } from 'react-router';
import { mockUser } from '@/features/dashboard/mocks/dashboard';
import { AppShell } from './layout/AppShell';
import { DashboardPage } from './routes/DashboardPage';
import { HomePage } from './routes/HomePage';
import { PlaceholderPage } from './routes/PlaceholderPage';

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

const placeholder = (path: string, title: string): RouteObject => ({
  path,
  element: <PlaceholderPage title={title} />,
});

export const routes: RouteObject[] = [
  { index: true, element: <Navigate to="/dashboard" replace /> },
  {
    // TODO(auth): the signed-in user will come from the session once the API exists.
    element: <AppShell user={mockUser} />,
    children: [
      { path: '/dashboard', element: <DashboardPage /> },
      placeholder('/dives', 'Mes plongées'),
      placeholder('/dives/new', 'Nouvelle plongée'),
      placeholder('/dives/:diveId', 'Détail de la plongée'),
      placeholder('/map', 'Carte'),
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
