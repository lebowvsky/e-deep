import type { UIMatch } from 'react-router';

/** What a route tells the app shell (route `handle`). */
export interface AppRouteHandle {
  /**
   * The page brings its own phone bars (the dive form: ✕ top bar, sticky save bar): no app top bar,
   * no FAB, and no shell padding above and below the page on phones.
   */
  ownMobileBars?: boolean;
}

const isAppRouteHandle = (handle: unknown): handle is AppRouteHandle =>
  typeof handle === 'object' && handle !== null;

/** One of the matched routes asks for its own phone bars. */
export function hasOwnMobileBars(matches: readonly UIMatch[]): boolean {
  return matches.some(({ handle }) => isAppRouteHandle(handle) && handle.ownMobileBars === true);
}
