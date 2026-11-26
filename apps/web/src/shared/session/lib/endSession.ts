import type { DeleteAccountRequest } from '@e-deep/shared';
import type { QueryClient } from '@tanstack/react-query';
import { isAuthFailure } from '../authClient';
import type { AuthServices } from '../authServices';

/** The three ways a session ends on the diver's request (docs/plans/auth-screens.md §1). */
export type SessionEnd =
  /** This session only (`/logout`). */
  | { kind: 'logout' }
  /** Every session of the account, this one included (`/settings` · Appareils connectés). */
  | { kind: 'logout-all' }
  /** The account itself, its password typed again (D38). */
  | { kind: 'delete-account'; request: DeleteAccountRequest };

const LOGOUT: SessionEnd = { kind: 'logout' };

/** The API call that closes the session as asked. */
function callFor({ authClient }: AuthServices, end: SessionEnd): Promise<void> {
  switch (end.kind) {
    case 'logout':
      return authClient.logout();
    case 'logout-all':
      return authClient.logoutAll();
    case 'delete-account':
      return authClient.deleteAccount(end.request);
  }
}

/**
 * Asks the API to end the session. A session already over (`401`) is a success when signing out
 * (one or every device): nothing is left to close. A deletion has no such shortcut: a refused
 * password, or a session lost on the way, leaves the account in place and rejects. A lost session
 * also gets the app's reaction to any `401` (`onSessionLost`: cache cleared, `/login?next=…`), which
 * this call, made outside the query cache, would otherwise never trigger.
 */
async function close(services: AuthServices, end: SessionEnd): Promise<void> {
  try {
    await callFor(services, end);
  } catch (error) {
    const isLost = isAuthFailure(error, 'unauthenticated');
    if (end.kind !== 'delete-account' && isLost) return;
    if (isLost) services.onSessionLost();
    throw error;
  }
}

/**
 * Ends the diver's session (D41): the API closes it (`end`, a plain logout by default), then
 * nothing of it stays in this tab (queries and mutations: the bodies of the dive writes are health
 * data too), on the device (drafts) or in the other tabs.
 *
 * Any failure (network, timeout, 5xx, a wrong password) rejects and changes nothing here: the
 * `HttpOnly` cookie is still valid, so clearing this tab would only pretend to sign out, and the
 * next load would show the logbook again. The exception is a deletion whose session is already
 * lost: it rejects too, after `onSessionLost` has taken the diver to the login page.
 */
export async function endSession(
  services: AuthServices,
  queryClient: QueryClient,
  end: SessionEnd = LOGOUT,
): Promise<void> {
  await close(services, end);
  queryClient.clear();
  services.purgeDeviceData();
  services.broadcast.announceLogout();
}
