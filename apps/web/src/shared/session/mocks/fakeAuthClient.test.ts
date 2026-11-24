import { describe, expect, it } from 'vitest';
import { isAuthFailure } from '../authClient';
import { createFakeAuthClient, FAKE_CREDENTIALS } from './fakeAuthClient';
import { ME_FIXTURE } from './me';

const refusalOf = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (e: unknown) => e,
  );

describe('fakeAuthClient', () => {
  it('signs in with the valid credentials, whatever the case of the email', async () => {
    const client = createFakeAuthClient({ session: null });
    await expect(client.me()).rejects.toMatchObject({ failure: { code: 'unauthenticated' } });

    const me = await client.login({
      email: ` ${FAKE_CREDENTIALS.email.toUpperCase()} `,
      password: FAKE_CREDENTIALS.password,
      rememberMe: true,
    });
    expect(me).toEqual(ME_FIXTURE);
    await expect(client.me()).resolves.toEqual(ME_FIXTURE);
  });

  it('answers the same refusal for an unknown email and a wrong password', async () => {
    const client = createFakeAuthClient({ session: null });
    const unknown = await refusalOf(
      client.login({ email: 'x@y.z', password: FAKE_CREDENTIALS.password, rememberMe: false }),
    );
    const wrong = await refusalOf(
      client.login({ email: FAKE_CREDENTIALS.email, password: 'nope', rememberMe: false }),
    );
    expect(isAuthFailure(unknown, 'invalid-credentials')).toBe(true);
    expect(isAuthFailure(wrong, 'invalid-credentials')).toBe(true);
  });

  it('throttles after too many failed attempts, valid credentials included', async () => {
    const client = createFakeAuthClient({ session: null, maxFailedLogins: 2, retryAfterS: 30 });
    const wrong = { email: FAKE_CREDENTIALS.email, password: 'nope', rememberMe: false };
    await refusalOf(client.login(wrong));
    await refusalOf(client.login(wrong));

    const error = await refusalOf(client.login({ ...FAKE_CREDENTIALS, rememberMe: false }));
    expect(isAuthFailure(error, 'too-many-attempts') && error.failure.retryAfterS).toBe(30);
  });

  it('refuses an account that already exists, and a short password', async () => {
    const client = createFakeAuthClient({ session: null });
    const taken = await refusalOf(
      client.signup({ firstName: 'Ana', email: FAKE_CREDENTIALS.email, password: 'x'.repeat(20) }),
    );
    expect(isAuthFailure(taken, 'email-taken')).toBe(true);

    const short = await refusalOf(
      client.signup({ firstName: 'Ana', email: 'ana@example.test', password: 'court' }),
    );
    expect(isAuthFailure(short, 'validation-failed') && short.failure.fieldErrors).toEqual({
      password: ['too-short'],
    });
  });

  it('refuses any sign-up in closed beta', async () => {
    const client = createFakeAuthClient({ session: null, registrationOpen: false });
    const error = await refusalOf(
      client.signup({ firstName: 'Ana', email: 'ana@example.test', password: 'x'.repeat(20) }),
    );
    expect(isAuthFailure(error, 'registration-closed')).toBe(true);
  });

  it('goes from sign-up to a complete profile, then logs out', async () => {
    const client = createFakeAuthClient({ session: null });
    const created = await client.signup({
      firstName: 'Ana',
      email: 'ana@example.test',
      password: 'x'.repeat(20),
    });
    expect(created).toMatchObject({ onboarding: 'profile-required', consent: null });

    const done = await client.completeOnboarding({
      lastName: null,
      certificationLevelId: 'ffessm-n1',
      healthDataConsent: true,
      policyVersion: '2026-11',
    });
    expect(done).toMatchObject({ onboarding: 'complete', diver: { level: { code: 'N1' } } });
    const again = await refusalOf(
      client.completeOnboarding({
        lastName: null,
        certificationLevelId: 'ffessm-n1',
        healthDataConsent: true,
        policyVersion: '2026-11',
      }),
    );
    expect(isAuthFailure(again, 'onboarding-complete')).toBe(true);

    await client.logout();
    expect(client.session).toBeNull();
  });

  it('renews a consent', async () => {
    const client = createFakeAuthClient({
      session: { ...ME_FIXTURE, onboarding: 'consent-required' },
    });
    const me = await client.grantConsent({
      purpose: 'health_data_processing',
      policyVersion: '2026-11',
    });
    expect(me.onboarding).toBe('complete');
  });
});
