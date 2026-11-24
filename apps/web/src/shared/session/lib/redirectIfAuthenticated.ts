import { redirect, type LoaderFunctionArgs } from 'react-router';
import { loadSession, type SessionLoaderDependencies } from './loadSession';
import { safeNext } from './safeNext';
import { ONBOARDING_PATHS } from './sessionPaths';

/**
 * Loader of the public auth pages (`/login`, later `/signup`): a signed-in diver goes to `next`
 * (internal paths only, `safeNext`), or to the onboarding page their status asks for. When the
 * session cannot be checked (network, 5xx), the page is shown: signing in will tell.
 */
export function redirectIfAuthenticated(dependencies: SessionLoaderDependencies) {
  return async ({ request }: Pick<LoaderFunctionArgs, 'request'>): Promise<Response | null> => {
    const me = await loadSession(dependencies).catch(() => null);
    if (me === null) return null;
    if (me.onboarding !== 'complete') return redirect(ONBOARDING_PATHS[me.onboarding]);
    return redirect(safeNext(new URL(request.url).searchParams.get('next')));
  };
}
