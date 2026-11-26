import type { OnboardingStatus } from '@e-deep/shared';
import { redirect, type LoaderFunctionArgs } from 'react-router';
import { loadSession, type SessionLoaderDependencies } from './loadSession';
import { loginPath, onboardingPath, pathOf } from './sessionPaths';

/**
 * Loader of the protected layout (D41): no session → `/login?next=<path>`; a profile still to
 * complete → `/welcome?next=<path>`, a consent to renew → `/consent?next=<path>`. The API stays the authority (D37): this
 * is only the UX of its refusals.
 */
export function requireSession(dependencies: SessionLoaderDependencies) {
  return async ({ request }: Pick<LoaderFunctionArgs, 'request'>): Promise<Response | null> => {
    const me = await loadSession(dependencies);
    if (me === null) return redirect(loginPath(pathOf(request.url)));
    if (me.onboarding === 'complete') return null;
    return redirect(onboardingPath(me.onboarding, pathOf(request.url)));
  };
}

/**
 * Loader of an onboarding page (`/welcome`, `/consent`): it needs a session but not a complete
 * profile. A diver whose status is another one is sent to the page of that status (a complete one
 * to `next` or the app), so that no redirect ever loops; the `next` of the page goes along.
 */
export function requireOnboardingStep(
  dependencies: SessionLoaderDependencies,
  step: Exclude<OnboardingStatus, 'complete'>,
) {
  return async ({ request }: Pick<LoaderFunctionArgs, 'request'>): Promise<Response | null> => {
    const me = await loadSession(dependencies);
    if (me === null) return redirect(loginPath(pathOf(request.url)));
    if (me.onboarding === step) return null;
    return redirect(onboardingPath(me.onboarding, new URL(request.url).searchParams.get('next')));
  };
}
