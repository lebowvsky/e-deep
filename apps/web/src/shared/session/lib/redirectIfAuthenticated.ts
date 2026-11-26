import { redirect, type LoaderFunctionArgs } from 'react-router';
import { loadSession, type SessionLoaderDependencies } from './loadSession';
import { safeNext } from './safeNext';
import { ONBOARDING_PATHS } from './sessionPaths';

/**
 * How long the public pages wait for `/me` before showing up anyway (ms). Much shorter than the
 * API client's 10 s: a visitor must not stare at « Chargement… » because the API is slow or down;
 * a signed-in diver then simply signs in again, or follows a link to the app.
 */
export const PUBLIC_SESSION_PROBE_TIMEOUT_MS = 3000;

/**
 * Loader of the public entry (`/`, `/login`, `/signup`): a signed-in diver goes to `next`
 * (internal paths only, `safeNext`), or to the onboarding page their status asks for. When the
 * session cannot be checked in time (network, 5xx, `PUBLIC_SESSION_PROBE_TIMEOUT_MS`), the page
 * is shown: signing in will tell.
 */
export function redirectIfAuthenticated(dependencies: SessionLoaderDependencies) {
  return async ({ request }: Pick<LoaderFunctionArgs, 'request'>): Promise<Response | null> => {
    const me = await loadSession(dependencies, {
      timeoutMs: PUBLIC_SESSION_PROBE_TIMEOUT_MS,
    }).catch(() => null);
    if (me === null) return null;
    if (me.onboarding !== 'complete') return redirect(ONBOARDING_PATHS[me.onboarding]);
    return redirect(safeNext(new URL(request.url).searchParams.get('next')));
  };
}
