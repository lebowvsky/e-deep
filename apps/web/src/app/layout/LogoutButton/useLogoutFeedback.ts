import { useEffect } from 'react';
import { useFetcher } from 'react-router';
import { useToast } from '@/shared/ui/Toast';
import { isLogoutFailure, LOGOUT_FETCHER_KEY } from '../../logoutRoute';

export const LOGOUT_FAILED_MESSAGE =
  'La déconnexion n’a pas abouti. Vérifie ton réseau et réessaie.';

/**
 * Announces a failed sign-out (toast): the session is still open, nothing was cleared. Call it once,
 * in a component that stays mounted with the app frame (`UserCard`): the sign-out form may sit in a
 * menu that closes.
 */
export function useLogoutFeedback(): void {
  const fetcher = useFetcher({ key: LOGOUT_FETCHER_KEY });
  const { notify } = useToast();
  // A new object for every answer: each failure is told once, even twice in a row.
  const answer: unknown = fetcher.state === 'idle' ? fetcher.data : undefined;

  useEffect(() => {
    if (isLogoutFailure(answer)) notify(LOGOUT_FAILED_MESSAGE);
  }, [answer, notify]);
}
