import { describe, expect, it } from 'vitest';
import { appConfig } from '@/shared/config/app';
import { devAppConfig, devAuthOptions } from './devState';

describe('dev ?state= forcing', () => {
  it.each(['guest', 'guest-signup'])('starts %s without a session', async (state) => {
    expect(await devAuthOptions(state)).toEqual({ session: null });
  });

  it('starts guest-throttled without a session, every login refused', async () => {
    expect(await devAuthOptions('guest-throttled')).toEqual({
      session: null,
      maxFailedLogins: 0,
    });
  });

  it('starts the onboarding states with a profile to complete', async () => {
    expect((await devAuthOptions('profile-required')).session?.onboarding).toBe('profile-required');
    expect(await devAuthOptions('profile-required-levels-error')).toMatchObject({
      levelsAvailable: false,
    });
    expect((await devAuthOptions('consent-required')).session?.onboarding).toBe('consent-required');
  });

  it('keeps the app states signed in', async () => {
    expect(await devAuthOptions('ready')).toEqual({});
  });

  it('opens the sign-up for guest-signup only', () => {
    expect(devAppConfig('guest-signup').features.signup).toBe(true);
    expect(devAppConfig('guest')).toBe(appConfig);
  });
});
