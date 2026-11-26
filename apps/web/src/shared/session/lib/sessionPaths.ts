import type { OnboardingStatus } from '@e-deep/shared';
import { DEFAULT_NEXT, safeNext } from './safeNext';

export const LOGIN_PATH = '/login';

/** The page each onboarding status leads to (D38): the app itself once the profile is complete. */
export const ONBOARDING_PATHS = {
  'profile-required': '/welcome',
  'consent-required': '/consent',
  complete: '/dashboard',
} as const satisfies Record<OnboardingStatus, string>;

/**
 * Where a diver of `status` goes on their way to `next`: the onboarding page of the status, which
 * leads to `next` once done (`/welcome?next=/dives`), or `next` itself for a complete profile.
 * `next` is read through `safeNext`: an unsafe one, or the default, is not carried along.
 */
export function onboardingPath(status: OnboardingStatus, next: string | null | undefined): string {
  const target = safeNext(next);
  if (status === 'complete') return target;
  const page = ONBOARDING_PATHS[status];
  return target === DEFAULT_NEXT
    ? page
    : `${page}?${new URLSearchParams({ next: target }).toString()}`;
}

/** `/login?next=<path>`: back to `next` once signed in (`safeNext` checks it on the way back). */
export function loginPath(next: string): string {
  return `${LOGIN_PATH}?${new URLSearchParams({ next }).toString()}`;
}

/** Path, query and hash of a URL: the `next` of the page being left. */
export function pathOf(url: string | URL): string {
  const { pathname, search, hash } = new URL(url);
  return `${pathname}${search}${hash}`;
}
