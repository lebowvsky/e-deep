import type { StaffRole } from '@e-deep/shared';
import { matchRoutes, redirect, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { fetchAdminMe } from '@/features/auth/api/adminAuthApi';
import { isApiHttpError, type ApiClient } from '@/shared/lib/apiClient';
import { isOneOf, isRecord } from '@/shared/lib/guards';
import { STAFF_ROLES } from '@/shared/lib/staffRoles';
import { canAccess } from './canAccess';
import { FORBIDDEN_PATH, loginPath, pathOf, safeNext } from './safeNext';
import type { AdminSession } from './session';

/** What the session loaders need: injected by `createRoutes`, never imported. */
export interface SessionLoaderDependencies {
  /** A client without `onSessionError`: these loaders turn a `401` / `403` into a redirect. */
  apiClient: ApiClient;
}

/** The roles a protected route is open to: declared by each route, read by its guard. */
export interface StaffRouteHandle {
  allowedRoles: readonly StaffRole[];
}

export type StaffRoute = RouteObject & { handle: StaffRouteHandle };

type LoaderArgs = Pick<LoaderFunctionArgs, 'request'>;

// React Router types `handle` as `any`: it is read back through a guard.
const isStaffRouteHandle = (value: unknown): value is StaffRouteHandle =>
  isRecord(value) &&
  Array.isArray(value.allowedRoles) &&
  value.allowedRoles.every((role) => isOneOf(role, STAFF_ROLES));

/** The roles of the deepest route of `routes` matching `pathname`; none when nothing matches. */
function allowedRolesAt(routes: readonly StaffRoute[], pathname: string): readonly StaffRole[] {
  const handle: unknown = matchRoutes([...routes], pathname)?.at(-1)?.route.handle;
  return isStaffRouteHandle(handle) ? handle.allowedRoles : [];
}

/**
 * Loader of the protected layout, the route guard: no session (`401`) → `/login?next=<path>`; a
 * role refused by the API (`403`) or by the page (`canAccess` on the `allowedRoles` of the route
 * matched among `routes`) → `/forbidden`. Any other failure rejects: the error element shows it.
 * The API stays the authority (D37): this is only the UX of its refusals.
 */
export function requireStaffSession(
  { apiClient }: SessionLoaderDependencies,
  routes: readonly StaffRoute[],
) {
  return async ({ request }: LoaderArgs): Promise<AdminSession | Response> => {
    let session: AdminSession;
    try {
      ({ account: session } = await fetchAdminMe(apiClient, { signal: request.signal }));
    } catch (error) {
      if (isApiHttpError(error, 401)) return redirect(loginPath(pathOf(request.url)));
      if (isApiHttpError(error, 403)) return redirect(FORBIDDEN_PATH);
      throw error;
    }
    const { pathname } = new URL(request.url);
    if (!canAccess(session, allowedRolesAt(routes, pathname))) return redirect(FORBIDDEN_PATH);
    return session;
  };
}

/**
 * Loader of `/login`: a signed-in staff member goes on to `next` (internal paths only,
 * `safeNext`). When the session cannot be checked (no session, network, 5xx), the form is shown:
 * signing in will tell.
 */
export function redirectIfSignedIn({ apiClient }: SessionLoaderDependencies) {
  return async ({ request }: LoaderArgs): Promise<Response | null> => {
    const isSignedIn = await fetchAdminMe(apiClient, { signal: request.signal }).then(
      () => true,
      () => false,
    );
    if (!isSignedIn) return null;
    return redirect(safeNext(new URL(request.url).searchParams.get('next')));
  };
}
