import type { DataRouter } from 'react-router';
import type { SessionEvent } from '@/shared/lib/apiClient';
import { FORBIDDEN_PATH, LOGIN_PATH, loginPath } from './safeNext';

type SessionRouter = Pick<DataRouter, 'state' | 'navigate'>;

/** `path` is shown, or already being loaded. */
function isOn({ state }: SessionRouter, path: string): boolean {
  return state.location.pathname === path || state.navigation.location?.pathname === path;
}

/**
 * The app's reaction to a `401` / `403` met by a call of a page (`onSessionError` of the API
 * client): signed out → `/login?next=<page>`, refused → `/forbidden`. `getRouter` is read at call
 * time: the client is built before the router. Both moves replace the page in the history, so
 * « Retour » does not lead back to a refused page; several failing calls lead to one move.
 */
export function createSessionNavigation(getRouter: () => SessionRouter) {
  return (event: SessionEvent): void => {
    const router = getRouter();
    if (isOn(router, LOGIN_PATH) || isOn(router, FORBIDDEN_PATH)) return;
    if (event === 'forbidden') {
      void router.navigate(FORBIDDEN_PATH, { replace: true });
      return;
    }
    const { pathname, search, hash } = router.state.location;
    void router.navigate(loginPath(`${pathname}${search}${hash}`), { replace: true });
  };
}
