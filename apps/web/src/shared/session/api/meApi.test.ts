import { describe, expect, it } from 'vitest';
import { ME_FIXTURE, NEW_ACCOUNT_FIXTURE } from '../mocks/me';
import { createFakeAuthClient } from '../mocks/fakeAuthClient';
import { isMeResponse, meQueryOptions, sessionKeys, toCurrentDiver } from './meApi';

describe('isMeResponse', () => {
  it.each([
    ['a complete profile', ME_FIXTURE],
    ['a new account (no level, no consent, no last name)', NEW_ACCOUNT_FIXTURE],
    ['a consent to renew', { ...ME_FIXTURE, onboarding: 'consent-required' }],
  ])('accepts %s', (_label, body) => {
    expect(isMeResponse(body)).toBe(true);
  });

  it.each([
    ['null', null],
    ['a staff account', { ...ME_FIXTURE, account: { email: 'a@b.c', role: 'admin' } }],
    ['an unknown status', { ...ME_FIXTURE, onboarding: 'pending' }],
    ['an unknown policy version', { ...ME_FIXTURE, currentPolicyVersion: '2030-01' }],
    [
      'a consent of an unknown version',
      { ...ME_FIXTURE, consent: { policyVersion: '1999', grantedAt: '2026-11-20' } },
    ],
    [
      'a level without label',
      { ...ME_FIXTURE, diver: { ...ME_FIXTURE.diver, level: { code: 'N2' } } },
    ],
    ['a missing diver id', { ...ME_FIXTURE, diver: { ...ME_FIXTURE.diver, id: 42 } }],
    [
      'an undefined last name',
      { ...ME_FIXTURE, diver: { ...ME_FIXTURE.diver, lastName: undefined } },
    ],
  ])('refuses %s', (_label, body) => {
    expect(isMeResponse(body)).toBe(false);
  });
});

describe('session query', () => {
  it('is cached for the whole session and marked as handling its own session errors', () => {
    const options = meQueryOptions(createFakeAuthClient());
    expect(options.queryKey).toEqual(['session', 'me']);
    expect(options.staleTime).toBe(Infinity);
    expect(options.meta).toEqual({ sessionProbe: true });
  });

  it('holds no token in its keys', () => {
    const keys = [sessionKeys.all, sessionKeys.me()].flat();
    expect(keys.every((part) => !/token|sid|cookie/i.test(part))).toBe(true);
  });
});

describe('toCurrentDiver', () => {
  it('gives the diver of a complete profile, without the avatar when there is none', () => {
    expect(toCurrentDiver(ME_FIXTURE)).toEqual({
      id: 'u1',
      firstName: 'Marine',
      lastName: 'Rousseau',
      level: { agency: 'FFESSM', code: 'N2', label: 'Niveau 2' },
    });
  });

  it('keeps the avatar', () => {
    const me = { ...ME_FIXTURE, diver: { ...ME_FIXTURE.diver, avatarUrl: '/a.webp' } };
    expect(toCurrentDiver(me)?.avatarUrl).toBe('/a.webp');
  });

  it('gives nothing while the level is unknown', () => {
    expect(toCurrentDiver(NEW_ACCOUNT_FIXTURE)).toBeNull();
  });
});
