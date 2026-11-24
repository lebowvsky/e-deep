/** Where a signed-in diver lands by default, and when `next` is refused. */
export const DEFAULT_NEXT = '/dashboard';

/** Longer than any real path of the app: refused rather than carried around. */
export const MAX_NEXT_LENGTH = 2048;

/**
 * Pages that are never a destination after signing in: the auth pages themselves (a loop at best,
 * a sign-out at worst with `/logout`), and the onboarding pages, which the session status alone
 * decides (`ONBOARDING_PATHS`), never a link.
 */
const SESSION_PAGES = ['/login', '/logout', '/signup', '/welcome', '/consent'] as const;

/** Origin the candidate is resolved against: reserved, so no real host can ever match it. */
const PROBE_ORIGIN = 'http://next.invalid';

/** C0 controls and DEL: invisible, and stripped or reinterpreted by URL parsers. */
const hasControlChar = (value: string) =>
  Array.from(value).some((char) => {
    const code = char.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });

const isSessionPage = (pathname: string) =>
  SESSION_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));

/**
 * The `next` of `/login?next=…` when it is a page of this app, normalised (`pathname + search +
 * hash` of the resolved URL); `DEFAULT_NEXT` otherwise (open redirect, D41).
 *
 * Refused: anything not starting with a single `/` (absolute URLs, `//host`, `/\host`, which
 * browsers read as `//host`), any backslash or control character (the URL parser strips tabs and
 * newlines, so `/<tab>/host` would become `//host`), a value longer than `MAX_NEXT_LENGTH`, what
 * leaves the origin once resolved, a path that normalises to `//…` (`/.//host`, `/a/..//host`),
 * and the session pages.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//') || value.length > MAX_NEXT_LENGTH) {
    return DEFAULT_NEXT;
  }
  if (hasControlChar(value) || value.includes('\\')) return DEFAULT_NEXT;
  const { origin, pathname, search, hash } = new URL(value, PROBE_ORIGIN);
  if (origin !== PROBE_ORIGIN || pathname.startsWith('//') || isSessionPage(pathname)) {
    return DEFAULT_NEXT;
  }
  return `${pathname}${search}${hash}`;
}
