import { appConfig, type AppConfig } from '@/shared/config/app';
import type { FakeAuthClientOptions } from '@/shared/session/mocks/fakeAuthClient';

/**
 * Development only (`?state=…`, comparison with the mockups, screenshots): the in-memory session
 * a forced state starts with. The `guest*` states have none, for the public pages; the onboarding
 * ones (`profile-required*` for `/welcome`, `consent-required` for `/consent`) have a profile to
 * complete; any other one (`ready`, `empty`, `loading` of the app screens) is signed in.
 *
 * Async: the fixtures are loaded with the fake (`services.ts`), never imported by the entry bundle.
 */
export async function devAuthOptions(state: string): Promise<FakeAuthClientOptions> {
  switch (state) {
    case 'guest':
    case 'guest-signup':
      return { session: null };
    case 'guest-throttled':
      return { session: null, maxFailedLogins: 0 };
    case 'profile-required':
      return { session: (await import('@/shared/session/mocks/me')).NEW_ACCOUNT_FIXTURE };
    case 'profile-required-levels-error':
      return {
        session: (await import('@/shared/session/mocks/me')).NEW_ACCOUNT_FIXTURE,
        levelsAvailable: false,
      };
    case 'consent-required': {
      const { ME_FIXTURE } = await import('@/shared/session/mocks/me');
      return { session: { ...ME_FIXTURE, onboarding: 'consent-required' } };
    }
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
