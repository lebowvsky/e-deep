import { createContext } from 'react';
import type { AuthClient } from './authClient';
import type { AuthBroadcast } from './lib/authBroadcast';

/** What the session hooks depend on, injected like the API client (`TestProviders` in tests). */
export interface AuthServices {
  authClient: AuthClient;
  broadcast: AuthBroadcast;
  /**
   * Erases what the device keeps of the diver (dive drafts, D41) when they sign out. Given by the
   * app, which knows the features that store something.
   */
  purgeDeviceData: () => void;
}

export const AuthServicesContext = createContext<AuthServices | null>(null);
