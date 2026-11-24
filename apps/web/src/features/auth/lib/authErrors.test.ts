import { describe, expect, it } from 'vitest';
import { ApiError } from '@/shared/lib/apiClient';
import { AuthError, type AuthFailure } from '@/shared/session/authClient';
import { bannerMessage, serverFieldError, toSubmitFailure } from './authErrors';

const NOW = 1_000_000;
const SENT = { firstName: 'Marine', email: 'marine@exemple.fr', password: 'motdepasse-courant' };
const refused = (failure: AuthFailure) => toSubmitFailure(new AuthError(failure), SENT, NOW);

describe('toSubmitFailure', () => {
  it('turns Retry-After into a deadline', () => {
    expect(refused({ code: 'too-many-attempts', retryAfterS: 90 })).toEqual({
      code: 'too-many-attempts',
      until: NOW + 90_000,
    });
    expect(refused({ code: 'too-many-attempts', retryAfterS: null })).toEqual({
      code: 'too-many-attempts',
      until: null,
    });
  });

  it('keeps the e-mail an account already uses', () => {
    expect(refused({ code: 'email-taken' })).toEqual({
      code: 'email-taken',
      email: 'marine@exemple.fr',
    });
  });

  it.each([
    ['too-short', '15 caractères minimum.'],
    ['too-long', '128 caractères maximum.'],
    ['compromised', 'Ce mot de passe est trop courant. Choisis-en un autre.'],
    ['contains-identity', 'Ton mot de passe ne doit pas contenir ton e-mail ni ton prénom.'],
    ['unknown-code', 'Ce mot de passe n’est pas accepté.'],
  ])('says why the password %s is refused', (code, message) => {
    const failure = refused({ code: 'validation-failed', fieldErrors: { password: [code] } });

    expect(failure).toMatchObject({
      code: 'invalid-fields',
      fields: { password: { value: SENT.password, message } },
    });
    expect(failure).toMatchObject({ compromised: code === 'compromised' ? SENT.password : null });
  });

  it('cannot show a refusal on a field the form does not have', () => {
    expect(
      refused({ code: 'validation-failed', fieldErrors: { rememberMe: ['invalid'] } }),
    ).toEqual({ code: 'unexpected' });
  });

  it('tells no answer from an unexpected one', () => {
    expect(toSubmitFailure(new ApiError('network', 'down'), SENT, NOW)).toEqual({
      code: 'network',
    });
    expect(toSubmitFailure(new ApiError('timeout', 'slow'), SENT, NOW)).toEqual({
      code: 'network',
    });
    expect(toSubmitFailure(new ApiError('http', 'HTTP 500', { status: 500 }), SENT, NOW)).toEqual({
      code: 'unexpected',
    });
    expect(refused({ code: 'onboarding-complete' })).toEqual({ code: 'unexpected' });
  });

  it('rethrows a bug rather than hiding it', () => {
    const bug = new TypeError('x is undefined');
    expect(() => toSubmitFailure(bug, SENT, NOW)).toThrow(bug);
  });
});

describe('bannerMessage', () => {
  it('says the throttling while it lasts, then nothing', () => {
    const failure = { code: 'too-many-attempts', until: NOW + 120_000 } as const;
    expect(bannerMessage(failure, 120)).toBe('Trop de tentatives. Réessaie dans 2 min.');
    expect(bannerMessage(failure, 0)).toBeNull();
    expect(bannerMessage({ code: 'too-many-attempts', until: null }, 0)).toBe(
      'Trop de tentatives. Réessaie dans quelques minutes.',
    );
  });

  it('keeps the field refusals for the fields', () => {
    expect(bannerMessage({ code: 'email-taken', email: 'a@b.fr' }, 0)).toBeNull();
    expect(bannerMessage(null, 0)).toBeNull();
  });
});

describe('serverFieldError', () => {
  it('holds while the value is the one refused', () => {
    const failure = refused({ code: 'validation-failed', fieldErrors: { email: ['invalid'] } });
    expect(serverFieldError(failure, 'email', SENT.email)).toBe(
      'Saisis une adresse e-mail valide.',
    );
    expect(serverFieldError(failure, 'email', 'autre@exemple.fr')).toBeNull();
    expect(serverFieldError(failure, 'password', SENT.password)).toBeNull();
  });
});
