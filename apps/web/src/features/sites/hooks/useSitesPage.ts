import { useSearchParams } from 'react-router';
import { useSites, type SitesState } from '@/shared/sites/hooks/useSites';

const FORCED_STATES = ['loading', 'empty', 'error'] as const;
type ForcedState = (typeof FORCED_STATES)[number];

function parseForcedState(value: string | null): ForcedState | null {
  return FORCED_STATES.find((state) => state === value) ?? null;
}

/** Forced, the error stays until the URL changes: nothing to read again. */
const KEEP_FORCED_ERROR = () => {};

/**
 * The user's sites for the sites pages (`/map`, `/sites/:id`): `useSites`.
 *
 * Development only: `?state=loading|empty|error` forces a state (comparison with the mockups),
 * without calling the API; `empty` is « no site » (on a site page: this site does not exist).
 * `?state=ready`, like no `state`, reads the API. Ignored in production builds.
 */
export function useSitesPage(): SitesState {
  const [searchParams] = useSearchParams();
  const forced = import.meta.env.DEV ? parseForcedState(searchParams.get('state')) : null;
  const state = useSites({ enabled: forced === null });

  switch (forced) {
    case null:
      return state;
    case 'loading':
      return { status: 'loading' };
    case 'empty':
      return { status: 'ready', entries: [] };
    case 'error':
      return { status: 'error', retry: KEEP_FORCED_ERROR };
  }
}
