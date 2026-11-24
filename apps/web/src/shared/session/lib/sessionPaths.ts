import type { OnboardingStatus } from '@e-deep/shared';

export const LOGIN_PATH = '/login';

/** The page each onboarding status leads to (D38): the app itself once the profile is complete. */
export const ONBOARDING_PATHS = {
  'profile-required': '/welcome',
  'consent-required': '/consent',
  complete: '/dashboard',
} as const satisfies Record<OnboardingStatus, string>;

/** `/login?next=<path>`: back to `next` once signed in (`safeNext` checks it on the way back). */
export function loginPath(next: string): string {
  return `${LOGIN_PATH}?${new URLSearchParams({ next }).toString()}`;
}

/** Path, query and hash of a URL: the `next` of the page being left. */
export function pathOf(url: string | URL): string {
  const { pathname, search, hash } = new URL(url);
  return `${pathname}${search}${hash}`;
}
