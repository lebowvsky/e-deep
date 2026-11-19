import type { UIMatch } from 'react-router';

/** What a route tells the app shell (route `handle`). */
export interface AppRouteHandle {
  /**
   * The page brings its own phone bars (the dive form: ✕ top bar, sticky save bar): no app top bar,
   * no FAB, and no shell padding above and below the page on phones.
   */
  ownMobileBars?: boolean;
  /** No FAB « Nouvelle plongée » on phones (the map, a site page). */
  hideFab?: boolean;
  /** Phones: the page goes edge to edge under the top bar (the map), no shell padding. */
  fullBleed?: boolean;
}

const isAppRouteHandle = (handle: unknown): handle is AppRouteHandle =>
  typeof handle === 'object' && handle !== null;

/** One of the matched routes sets `flag` in its handle. */
export function hasHandleFlag(
  matches: readonly UIMatch[],
  flag: 'ownMobileBars' | 'hideFab' | 'fullBleed',
): boolean {
  return matches.some(({ handle }) => isAppRouteHandle(handle) && handle[flag] === true);
}
