import type { AuthClient } from '@/shared/session/authClient';

/**
 * An `AuthClient` loaded on its first call. The app uses it for the dev `?state=` forcing only,
 * with a dynamic `import()` of the in-memory fake in a branch the production build drops (D41: no
 * simulated session in the bundle).
 */
export function lazyAuthClient(load: () => Promise<AuthClient>): AuthClient {
  let loaded: Promise<AuthClient> | null = null;
  const client = () => (loaded ??= load());
  return {
    me: (options) => client().then((c) => c.me(options)),
    login: (request) => client().then((c) => c.login(request)),
    signup: (request) => client().then((c) => c.signup(request)),
    logout: () => client().then((c) => c.logout()),
    completeOnboarding: (request) => client().then((c) => c.completeOnboarding(request)),
    grantConsent: (request) => client().then((c) => c.grantConsent(request)),
  };
}
