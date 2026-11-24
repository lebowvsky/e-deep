import type { DataRouter } from 'react-router';
import { purgeAllDrafts } from '@/features/dives/form/draftStore';
import { createQueryClient } from '@/shared/lib/queryClient';
import type { AuthClient } from '@/shared/session/authClient';
import type { AuthServices } from '@/shared/session/authServices';
import { clearCacheOnRemoteLogout, type AuthBroadcast } from '@/shared/session/lib/authBroadcast';
import { createSessionNavigation } from './sessionNavigation';

export interface AppSessionOptions {
  authClient: AuthClient;
  broadcast: AuthBroadcast;
  /** Read at call time: the router is built after the query client its loaders use. */
  getRouter: () => Pick<DataRouter, 'state' | 'navigate'>;
}

/**
 * The session wiring of the app, in one place (`services.ts`, and the tests that check it): the
 * query client and its session policy, the auth services of the hooks, and the cross-tab logout.
 */
export function createAppSession({ authClient, broadcast, getRouter }: AppSessionOptions) {
  const navigation = createSessionNavigation(getRouter);
  const queryClient = createQueryClient(navigation);
  const authServices: AuthServices = {
    authClient,
    broadcast,
    // Every feature that keeps something on the device: the dive drafts only, so far.
    purgeDeviceData: () => purgeAllDrafts(),
  };
  // Another tab signed out: drop this tab's cache and leave. Its drafts are already gone, and a
  // form unmounting here cannot write one again (`purgeAllDrafts` advances the drafts' epoch).
  const stopCrossTabLogout = clearCacheOnRemoteLogout(
    broadcast,
    queryClient,
    navigation.leaveForLogin,
  );
  return { queryClient, authServices, navigation, stopCrossTabLogout };
}
