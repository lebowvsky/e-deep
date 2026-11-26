import type { DataRouter } from 'react-router';
import type { SessionErrorPolicy } from '@/shared/lib/queryClient';
import { sessionKeys } from '@/shared/session/api/meApi';
import { sessionEventOf } from '@/shared/session/lib/sessionErrors';
import { LOGIN_PATH, loginPath, onboardingPath } from '@/shared/session/lib/sessionPaths';

export interface SessionNavigation extends SessionErrorPolicy {
  /** The session is over: to the login page, back here once signed in. */
  leaveForLogin: () => void;
}

type SessionRouter = Pick<DataRouter, 'state' | 'navigate'>;

/** The login page is shown, or already being loaded. */
function isOnLogin({ state }: SessionRouter): boolean {
  return (
    state.location.pathname === LOGIN_PATH || state.navigation.location?.pathname === LOGIN_PATH
  );
}

/**
 * The app's reaction to a session change revealed by a call (the policy of `createQueryClient`).
 * `getRouter` is read at call time: the query client is built before the router, whose loaders need
 * it. Both moves replace the page in the history: « Retour » must not lead back to a refused page.
 */
export function createSessionNavigation(getRouter: () => SessionRouter): SessionNavigation {
  /** The page shown: the `next` of the page it is left for. */
  const currentPath = ({ state }: SessionRouter) => {
    const { pathname, search, hash } = state.location;
    return `${pathname}${search}${hash}`;
  };
  const leaveForLogin = () => {
    const router = getRouter();
    // Several failing queries call it at once: the next ones find the login page on its way.
    if (isOnLogin(router)) return;
    void router.navigate(loginPath(currentPath(router)), { replace: true });
  };
  return {
    classify: sessionEventOf,
    sessionKey: sessionKeys.all,
    leaveForLogin,
    onUnauthenticated: leaveForLogin,
    // The loader of the target page reads the fresh `/me` and lets the diver stay or moves them on;
    // once the step is done, back to the page refused.
    onOnboardingRequired: (status) => {
      const router = getRouter();
      void router.navigate(onboardingPath(status, currentPath(router)), { replace: true });
    },
  };
}
