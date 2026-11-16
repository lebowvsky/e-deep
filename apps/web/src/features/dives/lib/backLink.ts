// Dive detail — the way back to the dive log, with its selection (filters, sort, page).
//
// The list puts its query string in the router `state` of each detail link; the detail page reads
// it back. A direct access (bookmark, shared link) has no state: back goes to `/dives`.
import { isRecord, isString } from '@/shared/lib/guards';

export const DIVE_LOG_PATH = '/dives';

/** Router state of a link to a dive detail. */
export interface DiveDetailLinkState {
  /** `location.search` of the list (« ?region=corse&page=2 »), or « ». */
  logSearch: string;
}

export function toDetailLinkState(logSearch: string): DiveDetailLinkState {
  return { logSearch };
}

/** The state is whatever the history holds: only a query string is trusted, nothing else. */
function readLogSearch(state: unknown): string {
  if (!isRecord(state) || !isString(state.logSearch)) return '';
  return state.logSearch.startsWith('?') ? state.logSearch : '';
}

/** `/dives?…` as the user left it, or `/dives` on a direct access. */
export function backToLogHref(state: unknown): string {
  return `${DIVE_LOG_PATH}${readLogSearch(state)}`;
}

/** Paging from a detail to its neighbours keeps the way back to the same selection. */
export function forwardLinkState(state: unknown): DiveDetailLinkState {
  return toDetailLinkState(readLogSearch(state));
}

export function diveDetailPath(id: string): string {
  return `${DIVE_LOG_PATH}/${encodeURIComponent(id)}`;
}
