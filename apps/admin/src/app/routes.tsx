import type { RouteObject, ShouldRevalidateFunction } from 'react-router';
import type { ApiClient } from '@/shared/lib/apiClient';
import { STAFF_ROLES } from '@/shared/lib/staffRoles';
import { FORBIDDEN_PATH, LOGOUT_PATH } from './access-control/safeNext';
import {
  redirectIfSignedIn,
  requireStaffSession,
  type StaffRoute,
} from './access-control/sessionLoaders';
import { isLogoutFailure, loginAction, logoutAction, logoutLoader } from './authRoutes';
import { ProtectedLayout } from './layout/ProtectedLayout';
import { DashboardPage } from './routes/DashboardPage';
import { ForbiddenPage } from './routes/ForbiddenPage';
import { LoginPage } from './routes/LoginPage';
import { NotFoundPage } from './routes/NotFoundPage';
import { RouteErrorPage } from './routes/RouteErrorPage';
import { SessionPending } from './routes/SessionPending';

/**
 * The protected pages, each with the roles it is open to (the guard of `requireStaffSession`).
 * A page in the sidebar declares the same roles on its nav item (`layout/navigation.ts`).
 */
const STAFF_ROUTES: StaffRoute[] = [
  { index: true, element: <DashboardPage />, handle: { allowedRoles: STAFF_ROLES } },
  // Any other path: the page says it does not exist, to any staff member.
  { path: '*', element: <NotFoundPage />, handle: { allowedRoles: STAFF_ROLES } },
];

/**
 * A page change checks the session and the roles again; so does a submission, unless it is a
 * failed sign-out: the session is unchanged, and a session check failing as well (API down) would
 * swap the layout, and the button's message, for the error element.
 */
const revalidateOnPageChange: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  formAction,
  actionResult,
  defaultShouldRevalidate,
}) => {
  if (currentUrl.pathname !== nextUrl.pathname) return true;
  if (formAction === LOGOUT_PATH && isLogoutFailure(actionResult)) return false;
  return defaultShouldRevalidate;
};

/** A refused login answers the form only: the session probe of `/login` need not run again. */
const noRevalidateAfterLogin: ShouldRevalidateFunction = ({
  formMethod,
  defaultShouldRevalidate,
}) => formMethod === undefined && defaultShouldRevalidate;

export interface RouteDependencies {
  /**
   * The client of the loaders and actions: without `onSessionError`, since they turn a `401` /
   * `403` into a redirect or a message themselves.
   */
  apiClient: ApiClient;
}

/**
 * The route table (React Router data mode, D42). The loaders and actions get the API client
 * injected: the app passes its own (`services.ts`), the tests theirs (`createMemoryRouter`).
 */
export function createRoutes({ apiClient }: RouteDependencies): RouteObject[] {
  return [
    {
      path: '/login',
      loader: redirectIfSignedIn({ apiClient }),
      action: loginAction({ apiClient }),
      shouldRevalidate: noRevalidateAfterLogin,
      HydrateFallback: SessionPending,
      errorElement: <RouteErrorPage />,
      Component: LoginPage,
    },
    {
      path: LOGOUT_PATH,
      loader: logoutLoader,
      action: logoutAction({ apiClient }),
      errorElement: <RouteErrorPage />,
    },
    { path: FORBIDDEN_PATH, Component: ForbiddenPage },
    {
      id: 'staff',
      loader: requireStaffSession({ apiClient }, STAFF_ROUTES),
      shouldRevalidate: revalidateOnPageChange,
      HydrateFallback: SessionPending,
      errorElement: <RouteErrorPage />,
      Component: ProtectedLayout,
      children: STAFF_ROUTES,
    },
  ];
}
