// An `AuthClient` in memory, for the tests and the dev `?state=` forcing only (D41): never imported
// by the app's providers, so no simulated session reaches the bundle. It plays the cases of the
// landing spec: valid credentials, an account that already exists, too many attempts.
import type { CertificationLevelRef, MeResponse } from '@e-deep/shared';
import { AuthError, type AuthClient, type AuthFailure } from '../authClient';
import { ME_FIXTURE } from './me';

/** The account the fake knows (`ME_FIXTURE`), and its password (15 characters or more, D35). */
export const FAKE_CREDENTIALS = {
  email: ME_FIXTURE.account.email,
  password: 'bulles-de-marine-2026',
} as const;

const MIN_PASSWORD_LENGTH = 15;

/** Levels selectable at `/welcome` in the fake, by id. */
const FAKE_LEVELS: Readonly<Record<string, CertificationLevelRef>> = {
  'ffessm-n1': { agency: 'FFESSM', code: 'N1', label: 'Niveau 1' },
  'ffessm-n2': { agency: 'FFESSM', code: 'N2', label: 'Niveau 2' },
};

export interface FakeAuthClientOptions {
  /** The session at start: signed in as `ME_FIXTURE` by default, `null` for none. */
  session?: MeResponse | null;
  /** Failed logins before `too-many-attempts`. */
  maxFailedLogins?: number;
  /** `Retry-After` of the throttled answers, in seconds. */
  retryAfterS?: number;
  /** `false`: closed beta, sign-up refused (D39). */
  registrationOpen?: boolean;
}

export interface FakeAuthClient extends AuthClient {
  /** The current session, for the assertions. */
  readonly session: MeResponse | null;
}

const normalise = (email: string) => email.trim().toLowerCase();

export function createFakeAuthClient({
  session: initialSession = ME_FIXTURE,
  maxFailedLogins = 5,
  retryAfterS = 60,
  registrationOpen = true,
}: FakeAuthClientOptions = {}): FakeAuthClient {
  let session = initialSession;
  let failedLogins = 0;
  const accounts = new Map<string, { password: string; me: MeResponse }>([
    [FAKE_CREDENTIALS.email, { password: FAKE_CREDENTIALS.password, me: ME_FIXTURE }],
  ]);

  const refuse = (failure: AuthFailure) => Promise.reject(new AuthError(failure));
  const signedIn = (me: MeResponse) => {
    session = me;
    return Promise.resolve(me);
  };

  return {
    get session() {
      return session;
    },

    me() {
      return session === null ? refuse({ code: 'unauthenticated' }) : Promise.resolve(session);
    },

    login({ email, password }) {
      if (failedLogins >= maxFailedLogins) {
        return refuse({ code: 'too-many-attempts', retryAfterS });
      }
      const account = accounts.get(normalise(email));
      if (account?.password !== password) {
        failedLogins += 1;
        return refuse({ code: 'invalid-credentials' });
      }
      failedLogins = 0;
      return signedIn(account.me);
    },

    signup({ firstName, email, password }) {
      if (!registrationOpen) return refuse({ code: 'registration-closed' });
      const key = normalise(email);
      if (accounts.has(key)) return refuse({ code: 'email-taken' });
      if (password.length < MIN_PASSWORD_LENGTH) {
        return refuse({ code: 'validation-failed', fieldErrors: { password: ['too-short'] } });
      }
      const me: MeResponse = {
        account: { email: key, role: 'diver' },
        diver: {
          id: `fake-${accounts.size + 1}`,
          firstName,
          lastName: null,
          level: null,
          avatarUrl: null,
        },
        consent: null,
        currentPolicyVersion: ME_FIXTURE.currentPolicyVersion,
        onboarding: 'profile-required',
      };
      accounts.set(key, { password, me });
      return signedIn(me);
    },

    logout() {
      session = null;
      return Promise.resolve();
    },

    completeOnboarding({ lastName, certificationLevelId, policyVersion }) {
      if (session === null) return refuse({ code: 'unauthenticated' });
      if (session.onboarding === 'complete') return refuse({ code: 'onboarding-complete' });
      const level = FAKE_LEVELS[certificationLevelId];
      if (level === undefined) {
        return refuse({
          code: 'validation-failed',
          fieldErrors: { certificationLevelId: ['invalid'] },
        });
      }
      return signedIn({
        ...session,
        diver: { ...session.diver, lastName, level },
        consent: { policyVersion, grantedAt: new Date().toISOString() },
        onboarding: 'complete',
      });
    },

    grantConsent({ policyVersion }) {
      if (session === null) return refuse({ code: 'unauthenticated' });
      return signedIn({
        ...session,
        consent: { policyVersion, grantedAt: new Date().toISOString() },
        onboarding: session.diver.level === null ? 'profile-required' : 'complete',
      });
    },
  };
}
