import { describe, expect, it } from 'vitest';
import { appConfig } from '@/shared/config/app';
import { devAppConfig, devAuthOptions } from './devState';

describe('dev ?state= forcing', () => {
  it.each(['guest', 'guest-signup'])('starts %s without a session', (state) => {
    expect(devAuthOptions(state)).toEqual({ session: null });
  });

  it('starts guest-throttled without a session, every login refused', () => {
    expect(devAuthOptions('guest-throttled')).toEqual({ session: null, maxFailedLogins: 0 });
  });

  it('keeps the app states signed in', () => {
    expect(devAuthOptions('ready')).toEqual({});
  });

  it('opens the sign-up for guest-signup only', () => {
    expect(devAppConfig('guest-signup').features.signup).toBe(true);
    expect(devAppConfig('guest')).toBe(appConfig);
  });
});
