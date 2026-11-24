import { useQuery } from '@tanstack/react-query';
import { meQueryOptions, toCurrentDiver } from '../api/meApi';
import type { CurrentDiver } from '../types';
import { useAuthServices } from './useAuthServices';

/**
 * The signed-in diver, for the screens of the app. The `requireSession` loader has put `/me` in the
 * cache and let only a complete profile in, so this only reads it, never fetches: when the session
 * ends while a screen is mounted (a `401` clears the cache, a logout in another tab), the screen
 * keeps the last known diver until the login page replaces it, instead of asking `/me` again and
 * failing on the way out.
 */
export function useCurrentDiver(): CurrentDiver {
  const { authClient } = useAuthServices();
  const { data } = useQuery({
    ...meQueryOptions(authClient),
    enabled: false,
    placeholderData: (previous) => previous,
    select: toCurrentDiver,
  });
  if (data === undefined || data === null) {
    throw new Error('useCurrentDiver needs a complete profile: render it under requireSession.');
  }
  return data;
}
