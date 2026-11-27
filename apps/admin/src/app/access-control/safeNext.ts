/** Where a signed-in staff member lands by default, and when `next` is refused. */
export const DEFAULT_NEXT = '/';

export const LOGIN_PATH = '/login';
export const LOGOUT_PATH = '/logout';
export const FORBIDDEN_PATH = '/forbidden';

/** Longer than any real path of the app: refused rather than carried around. */
export const MAX_NEXT_LENGTH = 2048;

/** Never a destination after signing in: a loop at best, a sign-out at worst. */
const SESSION_PAGES = [LOGIN_PATH, LOGOUT_PATH, FORBIDDEN_PATH] as const;

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
 * hash` of the resolved URL); `DEFAULT_NEXT` otherwise (no open redirect).
 *
 * Refused: anything not starting with a single `/` (absolute URLs, `//host`), any backslash or
 * control character (`/\host` and `/<tab>/host` both end up as `//host`), a value longer than
 * `MAX_NEXT_LENGTH`, what leaves the origin once resolved, a path that normalises to `//…`
 * (`/.//host`), and the session pages.
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

/** `/login?next=<path>`: back to `next` once signed in (`safeNext` checks it on the way back). */
export function loginPath(next: string): string {
  return next === DEFAULT_NEXT
    ? LOGIN_PATH
    : `${LOGIN_PATH}?${new URLSearchParams({ next }).toString()}`;
}

/** Path, query and hash of a URL: the `next` of the page being left. */
export function pathOf(url: string | URL): string {
  const { pathname, search, hash } = new URL(url);
  return `${pathname}${search}${hash}`;
}
