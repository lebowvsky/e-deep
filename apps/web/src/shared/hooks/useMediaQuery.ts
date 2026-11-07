import { useCallback, useSyncExternalStore } from 'react';

function getMediaQueryList(query: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query)
    : null;
}

/**
 * Live `matchMedia` result. Use it only where the DOM must differ (sidebar ↔ drawer);
 * plain responsive layout belongs in SCSS. Returns `false` when `matchMedia` is unavailable.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = getMediaQueryList(query);
      list?.addEventListener('change', onChange);
      return () => list?.removeEventListener('change', onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => getMediaQueryList(query)?.matches ?? false,
    () => false,
  );
}
