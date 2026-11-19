import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { parseMapQuery, serializeMapQuery, type MapQuery } from '../lib/mapQuery';

/** The map page state in the URL; `replace` for changes that should not add a history step. */
export function useMapQuery(): [
  MapQuery,
  (patch: Partial<MapQuery>, options?: { replace?: boolean }) => void,
] {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => parseMapQuery(searchParams), [searchParams]);
  const update = useCallback(
    (patch: Partial<MapQuery>, options: { replace?: boolean } = {}) => {
      setSearchParams(
        (current) => serializeMapQuery({ ...parseMapQuery(current), ...patch }, current),
        { replace: options.replace ?? false },
      );
    },
    [setSearchParams],
  );
  return [query, update];
}
