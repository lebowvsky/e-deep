import { useQueryClient } from '@tanstack/react-query';
import { endSession, type SessionEnd } from '../lib/endSession';
import { useAuthServices } from './useAuthServices';

/**
 * `endSession` with the services and the cache of the app, for the screens that end the session
 * themselves (`/settings`, `/consent`). Not a mutation: the cache it clears would hold it.
 */
export function useEndSession(): (end: SessionEnd) => Promise<void> {
  const services = useAuthServices();
  const queryClient = useQueryClient();
  return (end) => endSession(services, queryClient, end);
}
