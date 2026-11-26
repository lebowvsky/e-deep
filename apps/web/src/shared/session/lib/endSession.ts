import type { QueryClient } from '@tanstack/react-query';
import { isAuthFailure } from '../authClient';
import type { AuthServices } from '../authServices';

/**
 * Signs the diver out (D41), for the `/logout` route action (and any later caller): the API
 * closes the session, then nothing of it stays in this tab (queries and mutations: the bodies of
 * the dive writes are health data too), on the device (drafts) or in the other tabs.
 *
 * A session already over (`401`) is a success. Any other failure (network, timeout, 5xx) rejects
 * and changes nothing here: the `HttpOnly` cookie is still valid, so clearing this tab would only
 * pretend to sign out, and the next load would show the logbook again.
 */
export async function endSession(
  { authClient, broadcast, purgeDeviceData }: AuthServices,
  queryClient: QueryClient,
): Promise<void> {
  try {
    await authClient.logout();
  } catch (error) {
    if (!isAuthFailure(error, 'unauthenticated')) throw error;
  }
  queryClient.clear();
  purgeDeviceData();
  broadcast.announceLogout();
}
