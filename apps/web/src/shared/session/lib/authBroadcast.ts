// Tells the other tabs of this browser that the diver signed out (D41), so that none keeps showing
// the logbook of a closed session. Same origin only (`BroadcastChannel`); a browser without it
// simply gets no cross-tab signal: the next API call of the other tab answers 401 anyway.
import type { QueryClient } from '@tanstack/react-query';
import { isRecord } from '@/shared/lib/guards';

const CHANNEL_NAME = 'e-deep:auth';
const LOGOUT = 'logout';

/** The part of `BroadcastChannel` used here: a fake can stand for it in the tests. */
export interface BroadcastPort {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

export interface AuthBroadcast {
  /** Tells the other tabs (never this one) that the session is over. */
  announceLogout(): void;
  /** Calls `listener` when another tab signs out. Returns the unsubscription. */
  onLogout(listener: () => void): () => void;
}

const openBrowserChannel = (): BroadcastPort | null =>
  typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null;

const isLogoutMessage = (data: unknown) => isRecord(data) && data.type === LOGOUT;

/** One channel per app (module level): `BroadcastChannel` never echoes to its own instance. */
export function createAuthBroadcast(
  openChannel: () => BroadcastPort | null = openBrowserChannel,
): AuthBroadcast {
  const channel = openChannel();
  return {
    announceLogout() {
      channel?.postMessage({ type: LOGOUT });
    },
    onLogout(listener) {
      if (channel === null) return () => undefined;
      // Only the type is read: the message carries no identity.
      const handle = (event: MessageEvent) => {
        if (isLogoutMessage(event.data)) listener();
      };
      channel.addEventListener('message', handle);
      return () => channel.removeEventListener('message', handle);
    },
  };
}

/**
 * Another tab signed out: drop everything this one cached (the session and the logbook), then let
 * the app leave the page (`onSignedOut`). Returns the unsubscription.
 */
export function clearCacheOnRemoteLogout(
  broadcast: AuthBroadcast,
  queryClient: QueryClient,
  onSignedOut: () => void,
): () => void {
  return broadcast.onLogout(() => {
    queryClient.clear();
    onSignedOut();
  });
}
