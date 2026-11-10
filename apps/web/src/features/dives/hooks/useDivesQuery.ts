import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { parseDivesQuery, serializeDivesQuery, updateDivesQuery } from '../lib/query';
import type { DivesQuery } from '../types';

export interface UpdateOptions {
  /**
   * Replace the history entry instead of pushing one: for changes made while typing (search), so
   * that « back » does not replay every keystroke.
   */
  replace?: boolean;
}

/**
 * The dive log query, kept in the URL (shareable view, kept when coming back from a dive).
 * Changing anything other than the page goes back to page 1.
 */
export function useDivesQuery(): [
  DivesQuery,
  (patch: Partial<DivesQuery>, options?: UpdateOptions) => void,
] {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => parseDivesQuery(searchParams), [searchParams]);

  const update = useCallback(
    (patch: Partial<DivesQuery>, options: UpdateOptions = {}) => {
      setSearchParams(
        (current) =>
          serializeDivesQuery(updateDivesQuery(parseDivesQuery(current), patch), current),
        { replace: options.replace ?? false },
      );
    },
    [setSearchParams],
  );

  return [query, update];
}
