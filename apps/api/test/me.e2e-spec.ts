import type {
  AdminMeResponse,
  ApiDomainErrorResponse,
  ApiValidationErrorResponse,
  CertificationLevelListResponse,
  MeResponse,
} from '@e-deep/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  DomainValidationError,
  InactiveCertificationLevelError,
  InvalidCredentialsError,
  OnboardingCompleteError,
  TooManyAttemptsError,
  UnauthenticatedError,
} from '../src/common/errors/domain-errors';
import {
  ACCOUNT_ID,
  ADMIN_COOKIE,
  COMPLETE,
  DIVER_ID,
  DIVER_SESSION,
  EMAIL,
  INCOMPLETE,
  LEVEL,
  LEVEL_ID,
  NEW_TOKEN,
  OTHER_TOKEN,
  PERSISTENT,
  PERSISTENT_MAX_AGE,
  SESSION_ID,
  SHORT,
  STAFF_ACCOUNT_ID,
  STAFF_EMAIL,
  STAFF_SESSION,
  TOKEN,
  WEB_COOKIE,
  createAuthTestApp,
  sameOrigin,
  fakes,
  resetFakes,
  singleSetCookie,
} from './support/auth-app';

const PASSWORD = 'coral reef at dawn, twice';
const NEW_PASSWORD = 'night dive under the full moon';
/** Planted in refused bodies: no error body may echo it (D-26). */
const MARKER = 'zq-echo-marker';

const ME: MeResponse = {
  account: { email: EMAIL, role: 'diver' },
  diver: {
    id: DIVER_ID,
    firstName: 'Marine',
    lastName: 'Rousseau',
    level: { agency: 'FFESSM', code: 'N2', label: 'Niveau 2' },
    avatarUrl: null,
  },
  consent: { policyVersion: '2026-11', grantedAt: '2026-11-20T08:00:00.000Z' },
  currentPolicyVersion: '2026-11',
  onboarding: 'complete',
};

const ONBOARDING = {
  lastName: 'Rousseau',
  certificationLevelId: LEVEL_ID,
  healthDataConsent: true,
  policyVersion: '2026-11',
};
const CONSENT = { purpose: 'health_data_processing', policyVersion: '2026-11' };

const UNAUTHENTICATED: ApiDomainErrorResponse = { statusCode: 401, code: 'unauthenticated' };
const FORBIDDEN: ApiDomainErrorResponse = { statusCode: 403, code: 'forbidden' };
const INVALID_CREDENTIALS: ApiDomainErrorResponse = {
  statusCode: 401,
  code: 'invalid-credentials',
};
const TOO_MANY: ApiDomainErrorResponse = { statusCode: 429, code: 'too-many-attempts' };

function validationFailed(fieldErrors: Record<string, string[]>): ApiValidationErrorResponse {
  return { statusCode: 400, code: 'validation-failed', fieldErrors };
}

type Method = 'get' | 'post' | 'put' | 'delete';

describe('/api/me and /api/admin/me (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createAuthTestApp({ secureCookies: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(resetFakes);

  const server = () => sameOrigin(app);
  const signedIn = () => fakes.sessions.resolve.mockResolvedValue(DIVER_SESSION);
  const call = (method: Method, path: string, cookie?: string) => {
    const test = server()[method](path);
    return cookie === undefined ? test : test.set('Cookie', cookie);
  };

  /** Every web account route, with a body that passes its DTO. */
  const WEB_ROUTES: [Method, string, object][] = [
    ['get', '/api/me', {}],
    ['post', '/api/me/onboarding', ONBOARDING],
    ['post', '/api/me/consents', CONSENT],
    ['put', '/api/me/password', { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }],
    ['delete', '/api/me', { password: PASSWORD }],
  ];

  describe('web session guard', () => {
    it.each(WEB_ROUTES)(
      '%s %s: 401 unauthenticated without a cookie, no-store',
      async (method, path, body) => {
        const response = await call(method, path).send(body).expect(401);

        expect(response.body).toStrictEqual(UNAUTHENTICATED);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(fakes.sessions.resolve).not.toHaveBeenCalled();
      },
    );

    it.each(WEB_ROUTES)(
      '%s %s: 401 for an unknown or expired session',
      async (method, path, body) => {
        const response = await call(method, path, WEB_COOKIE).send(body).expect(401);

        expect(response.body).toStrictEqual(UNAUTHENTICATED);
        expect(fakes.sessions.resolve).toHaveBeenCalledWith(TOKEN, 'web');
        expect(fakes.sessions.touch).not.toHaveBeenCalled();
      },
    );

    it('401 with the admin cookie only: the audience comes from the cookie name', async () => {
      fakes.sessions.resolve.mockResolvedValue(STAFF_SESSION);

      const response = await call('get', '/api/me', ADMIN_COOKIE).expect(401);

      expect(response.body).toStrictEqual(UNAUTHENTICATED);
      expect(fakes.sessions.resolve).not.toHaveBeenCalled();
    });

    it('401 when two different web cookies are presented (ambiguous)', async () => {
      signedIn();

      await call('get', '/api/me', `${WEB_COOKIE}; edeep_sid=${OTHER_TOKEN}`).expect(401);

      expect(fakes.sessions.resolve).not.toHaveBeenCalled();
    });

    // Defence in depth: the real `SessionService.resolve` already returns `null` for a staff
    // account on the web audience (a 401 in practice). A fake that resolves it checks the branch.
    it('403 forbidden if a staff session ever resolved on the web audience', async () => {
      fakes.sessions.resolve.mockResolvedValue({ ...STAFF_SESSION, audience: 'web' });

      const response = await call('get', '/api/me', WEB_COOKIE).expect(403);

      expect(response.body).toStrictEqual(FORBIDDEN);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(fakes.sessions.touch).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/me', () => {
    it('200 MeResponse of the session diver; the session is touched', async () => {
      signedIn();

      const response = await call('get', '/api/me', WEB_COOKIE).expect(200);

      expect(response.body).toStrictEqual(ME);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(fakes.sessions.touch).toHaveBeenCalledWith(DIVER_SESSION);
      expect(fakes.onboarding.stateOf).toHaveBeenCalledWith(DIVER_ID);
      expect(fakes.accounts.identityOf).toHaveBeenCalledWith(ACCOUNT_ID);
    });

    it('200 for an incomplete profile: onboarding computed by the API', async () => {
      signedIn();
      fakes.onboarding.stateOf.mockResolvedValue(INCOMPLETE);

      const response = await call('get', '/api/me', WEB_COOKIE).expect(200);

      expect(response.body).toMatchObject({
        diver: { lastName: null, level: null },
        consent: null,
        currentPolicyVersion: '2026-11',
        onboarding: 'profile-required',
      });
    });

    it('401 when the account was deleted meanwhile', async () => {
      signedIn();
      fakes.accounts.identityOf.mockRejectedValue(new UnauthenticatedError());

      await call('get', '/api/me', WEB_COOKIE).expect(401);
    });

    it('401 when the diver was deleted meanwhile (stateOf), not a 500', async () => {
      signedIn();
      fakes.onboarding.stateOf.mockRejectedValue(new UnauthenticatedError());

      const response = await call('get', '/api/me', WEB_COOKIE).expect(401);

      expect(response.body).toStrictEqual(UNAUTHENTICATED);
    });
  });

  describe('POST /api/me/onboarding', () => {
    it('200 MeResponse complete; the diver comes from the session', async () => {
      signedIn();
      fakes.onboarding.complete.mockResolvedValue(COMPLETE);

      const response = await call('post', '/api/me/onboarding', WEB_COOKIE)
        .send(ONBOARDING)
        .expect(200);

      expect(response.body).toStrictEqual(ME);
      expect(fakes.onboarding.complete).toHaveBeenCalledWith({
        accountId: ACCOUNT_ID,
        diverId: DIVER_ID,
        lastName: 'Rousseau',
        certificationLevelId: LEVEL_ID,
        policyVersion: '2026-11',
      });
    });

    it('accepts a null last name', async () => {
      signedIn();
      fakes.onboarding.complete.mockResolvedValue(COMPLETE);

      await call('post', '/api/me/onboarding', WEB_COOKIE)
        .send({ ...ONBOARDING, lastName: null })
        .expect(200);

      expect(fakes.onboarding.complete).toHaveBeenCalledWith(
        expect.objectContaining({ lastName: null }),
      );
    });

    it('409 onboarding-complete when already done', async () => {
      signedIn();
      fakes.onboarding.complete.mockRejectedValue(new OnboardingCompleteError());

      const response = await call('post', '/api/me/onboarding', WEB_COOKIE)
        .send(ONBOARDING)
        .expect(409);

      expect(response.body).toStrictEqual({ statusCode: 409, code: 'onboarding-complete' });
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('422 for an inactive level', async () => {
      signedIn();
      fakes.onboarding.complete.mockRejectedValue(new InactiveCertificationLevelError());

      const response = await call('post', '/api/me/onboarding', WEB_COOKIE)
        .send(ONBOARDING)
        .expect(422);

      expect(response.body).toStrictEqual({
        statusCode: 422,
        code: 'inactive-certification-level',
      });
    });

    it('400 outdated for a known version that is no longer current (service)', async () => {
      signedIn();
      fakes.onboarding.complete.mockRejectedValue(
        new DomainValidationError({ policyVersion: ['outdated'] }),
      );

      const response = await call('post', '/api/me/onboarding', WEB_COOKIE)
        .send(ONBOARDING)
        .expect(400);

      expect(response.body).toStrictEqual(validationFailed({ policyVersion: ['outdated'] }));
    });

    it.each<[string, Record<string, unknown>, Record<string, string[]>]>([
      [
        'a missing last name (null is the empty value)',
        { lastName: undefined },
        { lastName: ['required'] },
      ],
      [
        'a last name of 101 characters',
        { lastName: `${MARKER}${'a'.repeat(87)}` },
        { lastName: ['length'] },
      ],
      [
        'a missing level',
        { certificationLevelId: undefined },
        { certificationLevelId: ['required'] },
      ],
      [
        'a level that is not a UUID',
        { certificationLevelId: MARKER },
        { certificationLevelId: ['uuid'] },
      ],
      ['an unchecked consent box', { healthDataConsent: false }, { healthDataConsent: ['in'] }],
      [
        'a missing consent box',
        { healthDataConsent: undefined },
        { healthDataConsent: ['required'] },
      ],
      ['a consent box as a string', { healthDataConsent: 'true' }, { healthDataConsent: ['type'] }],
      ['an unknown policy version', { policyVersion: MARKER }, { policyVersion: ['in'] }],
      ['an unknown property', { diverId: DIVER_ID }, { _unknown: ['unknown'] }],
    ])('400 for %s, without calling the service', async (_case, patch, fieldErrors) => {
      signedIn();

      const response = await call('post', '/api/me/onboarding', WEB_COOKIE)
        .send({ ...ONBOARDING, ...patch })
        .expect(400);

      expect(response.body).toStrictEqual(validationFailed(fieldErrors));
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.text).not.toContain(MARKER);
      expect(fakes.onboarding.complete).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/me/consents', () => {
    it('201 MeResponse after the consent is granted', async () => {
      signedIn();
      fakes.consents.grant.mockResolvedValue(COMPLETE.consent);

      const response = await call('post', '/api/me/consents', WEB_COOKIE).send(CONSENT).expect(201);

      expect(response.body).toStrictEqual(ME);
      expect(fakes.consents.grant).toHaveBeenCalledWith({
        accountId: ACCOUNT_ID,
        diverId: DIVER_ID,
        purpose: 'health_data_processing',
        policyVersion: '2026-11',
      });
    });

    it('400 outdated for a version that is not current (service)', async () => {
      signedIn();
      fakes.consents.grant.mockRejectedValue(
        new DomainValidationError({ policyVersion: ['outdated'] }),
      );

      const response = await call('post', '/api/me/consents', WEB_COOKIE).send(CONSENT).expect(400);

      expect(response.body).toStrictEqual(validationFailed({ policyVersion: ['outdated'] }));
    });

    it.each<[string, Record<string, unknown>, Record<string, string[]>]>([
      ['an unknown purpose', { purpose: MARKER }, { purpose: ['in'] }],
      ['a missing purpose', { purpose: undefined }, { purpose: ['required'] }],
      ['an unknown policy version', { policyVersion: MARKER }, { policyVersion: ['in'] }],
    ])('400 for %s, without calling the service', async (_case, patch, fieldErrors) => {
      signedIn();

      const response = await call('post', '/api/me/consents', WEB_COOKIE)
        .send({ ...CONSENT, ...patch })
        .expect(400);

      expect(response.body).toStrictEqual(validationFailed(fieldErrors));
      expect(response.text).not.toContain(MARKER);
      expect(fakes.consents.grant).not.toHaveBeenCalled();
    });
  });

  describe('PUT /api/me/password', () => {
    const CHANGE = { currentPassword: PASSWORD, newPassword: NEW_PASSWORD };

    it('204: the cookie rotated, persistence kept (Max-Age)', async () => {
      signedIn();
      fakes.accounts.changePassword.mockResolvedValue(PERSISTENT);

      const response = await call('put', '/api/me/password', WEB_COOKIE).send(CHANGE).expect(204);

      const cookie = singleSetCookie(response.headers['set-cookie']);
      expect(cookie.name).toBe('edeep_sid');
      expect(cookie.value).toBe(NEW_TOKEN);
      expect(cookie.attributes.get('max-age')).toBe(PERSISTENT_MAX_AGE);
      expect(response.text).toBe('');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(fakes.accounts.changePassword).toHaveBeenCalledWith(
        { accountId: ACCOUNT_ID, sessionId: SESSION_ID, ip: '127.0.0.1' },
        CHANGE,
      );
    });

    it('204: a short session stays a browser-session cookie', async () => {
      signedIn();
      fakes.accounts.changePassword.mockResolvedValue(SHORT);

      const response = await call('put', '/api/me/password', WEB_COOKIE).send(CHANGE).expect(204);

      expect(singleSetCookie(response.headers['set-cookie']).attributes.has('max-age')).toBe(false);
    });

    it('401 invalid-credentials for a wrong current password; cookie kept', async () => {
      signedIn();
      fakes.accounts.changePassword.mockRejectedValue(new InvalidCredentialsError());

      const response = await call('put', '/api/me/password', WEB_COOKIE)
        .send({ ...CHANGE, currentPassword: MARKER })
        .expect(401);

      expect(response.body).toStrictEqual(INVALID_CREDENTIALS);
      expect(response.text).not.toContain(MARKER);
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('429 too-many-attempts with Retry-After', async () => {
      signedIn();
      fakes.accounts.changePassword.mockRejectedValue(new TooManyAttemptsError(60));

      const response = await call('put', '/api/me/password', WEB_COOKIE).send(CHANGE).expect(429);

      expect(response.body).toStrictEqual(TOO_MANY);
      expect(response.headers['retry-after']).toBe('60');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('400 from the policy on newPassword, without the password', async () => {
      signedIn();
      fakes.accounts.changePassword.mockRejectedValue(
        new DomainValidationError({ newPassword: ['too-short'] }),
      );

      const response = await call('put', '/api/me/password', WEB_COOKIE)
        .send({ ...CHANGE, newPassword: MARKER })
        .expect(400);

      expect(response.body).toStrictEqual(validationFailed({ newPassword: ['too-short'] }));
      expect(response.text).not.toContain(MARKER);
    });

    it.each<[string, Record<string, unknown>, Record<string, string[]>]>([
      [
        'a missing current password',
        { currentPassword: undefined },
        { currentPassword: ['required'] },
      ],
      [
        'a current password of 129 characters',
        { currentPassword: `${MARKER}${'p'.repeat(115)}` },
        { currentPassword: ['too-long'] },
      ],
      [
        'a new password of 129 characters',
        { newPassword: `${MARKER}${'p'.repeat(115)}` },
        { newPassword: ['too-long'] },
      ],
      ['a mistyped new password', { newPassword: ['a'] }, { newPassword: ['type'] }],
    ])('400 for %s, before any Argon2id work', async (_case, patch, fieldErrors) => {
      signedIn();

      const response = await call('put', '/api/me/password', WEB_COOKIE)
        .send({ ...CHANGE, ...patch })
        .expect(400);

      expect(response.body).toStrictEqual(validationFailed(fieldErrors));
      expect(response.text).not.toContain(MARKER);
      expect(fakes.accounts.changePassword).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/me', () => {
    it('204: the account erased and the cookie cleared', async () => {
      signedIn();
      fakes.accounts.deleteAccount.mockResolvedValue(undefined);

      const response = await call('delete', '/api/me', WEB_COOKIE)
        .send({ password: PASSWORD })
        .expect(204);

      const cookie = singleSetCookie(response.headers['set-cookie']);
      expect(cookie.name).toBe('edeep_sid');
      expect(cookie.value).toBe('');
      expect(cookie.attributes.get('expires')).toBe('Thu, 01 Jan 1970 00:00:00 GMT');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(fakes.accounts.deleteAccount).toHaveBeenCalledWith(
        { accountId: ACCOUNT_ID, sessionId: SESSION_ID, ip: '127.0.0.1' },
        PASSWORD,
      );
    });

    it('401 invalid-credentials for a wrong password; cookie kept', async () => {
      signedIn();
      fakes.accounts.deleteAccount.mockRejectedValue(new InvalidCredentialsError());

      const response = await call('delete', '/api/me', WEB_COOKIE)
        .send({ password: MARKER })
        .expect(401);

      expect(response.body).toStrictEqual(INVALID_CREDENTIALS);
      expect(response.text).not.toContain(MARKER);
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('429 too-many-attempts with Retry-After', async () => {
      signedIn();
      fakes.accounts.deleteAccount.mockRejectedValue(new TooManyAttemptsError(9));

      const response = await call('delete', '/api/me', WEB_COOKIE)
        .send({ password: PASSWORD })
        .expect(429);

      expect(response.body).toStrictEqual(TOO_MANY);
      expect(response.headers['retry-after']).toBe('9');
    });

    it.each<[string, object, Record<string, string[]>]>([
      ['no body', {}, { password: ['required'] }],
      [
        'a password of 129 characters',
        { password: `${MARKER}${'p'.repeat(115)}` },
        { password: ['too-long'] },
      ],
    ])('400 for %s, without calling the service', async (_case, body, fieldErrors) => {
      signedIn();

      const response = await call('delete', '/api/me', WEB_COOKIE).send(body).expect(400);

      expect(response.body).toStrictEqual(validationFailed(fieldErrors));
      expect(response.text).not.toContain(MARKER);
      expect(fakes.accounts.deleteAccount).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/admin/me', () => {
    it('200 AdminMeResponse of the staff session', async () => {
      fakes.sessions.resolve.mockResolvedValue(STAFF_SESSION);
      fakes.accounts.identityOf.mockResolvedValue({ email: STAFF_EMAIL, role: 'support' });

      const response = await call('get', '/api/admin/me', ADMIN_COOKIE).expect(200);

      expect(response.body).toStrictEqual({
        account: { email: STAFF_EMAIL, role: 'support' },
      } satisfies AdminMeResponse);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(fakes.sessions.resolve).toHaveBeenCalledWith(TOKEN, 'admin');
      expect(fakes.sessions.touch).toHaveBeenCalledWith(STAFF_SESSION);
      expect(fakes.accounts.identityOf).toHaveBeenCalledWith(STAFF_ACCOUNT_ID);
    });

    it.each([
      ['without a cookie', undefined],
      ['with the web cookie only', WEB_COOKIE],
      ['with an unknown admin cookie', ADMIN_COOKIE],
    ])('401 unauthenticated %s, no-store', async (_case, cookie) => {
      const response = await call('get', '/api/admin/me', cookie).expect(401);

      expect(response.body).toStrictEqual(UNAUTHENTICATED);
      expect(response.headers['cache-control']).toBe('no-store');
    });

    // Defence in depth, as above: unreachable with the real `SessionService.resolve`.
    it('403 forbidden if a diver session ever resolved on the admin audience', async () => {
      fakes.sessions.resolve.mockResolvedValue({ ...DIVER_SESSION, audience: 'admin' });

      const response = await call('get', '/api/admin/me', ADMIN_COOKIE).expect(403);

      expect(response.body).toStrictEqual(FORBIDDEN);
      expect(fakes.accounts.identityOf).not.toHaveBeenCalled();
    });

    it('403 forbidden when the stored role is no longer a staff one', async () => {
      fakes.sessions.resolve.mockResolvedValue(STAFF_SESSION);
      fakes.accounts.identityOf.mockResolvedValue({ email: STAFF_EMAIL, role: 'diver' });

      const response = await call('get', '/api/admin/me', ADMIN_COOKIE).expect(403);

      expect(response.body).toStrictEqual(FORBIDDEN);
      expect(response.text).not.toContain(STAFF_EMAIL);
    });
  });
});

describe('/api/certification-levels (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createAuthTestApp({ secureCookies: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(resetFakes);

  it('200: the active levels, public and without a session', async () => {
    fakes.levels.findActive.mockResolvedValue([LEVEL]);

    const response = await request(app.getHttpServer())
      .get('/api/certification-levels')
      .expect(200);

    expect(response.body).toStrictEqual({
      levels: [{ id: LEVEL_ID, agency: 'FFESSM', code: 'N2', label: 'Niveau 2' }],
    } satisfies CertificationLevelListResponse);
    expect(response.headers['cache-control']).toBeUndefined();
    expect(fakes.sessions.resolve).not.toHaveBeenCalled();
  });
});
