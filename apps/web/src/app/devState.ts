import { appConfig, type AppConfig } from '@/shared/config/app';
import type { FakeAuthClientOptions } from '@/shared/session/mocks/fakeAuthClient';

/**
 * Development only (`?state=…`, comparison with the mockups, screenshots): the in-memory session
 * a forced state starts with. The `guest*` states have none, for the public pages; any other one
 * (`ready`, `empty`, `loading` of the app screens) is signed in.
 */
export function devAuthOptions(state: string): FakeAuthClientOptions {
  switch (state) {
    case 'guest':
    case 'guest-signup':
      return { session: null };
    case 'guest-throttled':
      return { session: null, maxFailedLogins: 0 };
    default:
      return {};
  }
}

/** `?state=guest-signup`: the sign-up open, whatever the beta says (capture 51). */
export function devAppConfig(state: string): AppConfig {
  return state === 'guest-signup'
    ? { ...appConfig, features: { ...appConfig.features, signup: true } }
    : appConfig;
}
