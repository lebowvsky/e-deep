import { mockDives } from '../mocks/dives';
import type { LoggedDive } from '../types';

/**
 * The user's whole dive log. Mocked for now (no endpoint yet): the selection is computed client
 * side by `selectDives`. A paginated `GET /api/dives` will replace both without changing
 * `useDives`.
 */
export function fetchDiveLog(): Promise<LoggedDive[]> {
  return Promise.resolve(mockDives);
}
