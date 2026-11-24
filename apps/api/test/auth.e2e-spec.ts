import type {
  AdminMeResponse,
  ApiDomainErrorResponse,
  ApiValidationErrorResponse,
  MeResponse,
} from '@e-deep/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import {
  DomainValidationError,
  EmailTakenError,
  InvalidCredentialsError,
  RegistrationClosedError,
  TooManyAttemptsError,
} from '../src/common/errors/domain-errors';
import {
  ACCOUNT_ID,
  DIVER_ACCOUNT,
  DIVER_ID,
  DIVER_SESSION,
  EMAIL,
  INCOMPLETE,
  NEW_TOKEN,
  OTHER_TOKEN,
  PERSISTENT,
  PERSISTENT_MAX_AGE,
  SHORT,
  STAFF_ACCOUNT,
  STAFF_EMAIL,
  TOKEN,
  createAuthTestApp,
  fakes,
  resetFakes,
  setCookies,
  singleSetCookie,
} from './support/auth-app';

const PASSWORD = 'coral reef at dawn, twice';
/** Planted in refused bodies: no error body may echo it (D-26). */
const MARKER = 'zq-echo-marker';

const REGISTER = { firstName: 'Marine', email: EMAIL, password: PASSWORD };
const LOGIN = { email: EMAIL, password: PASSWORD, rememberMe: true };
const ADMIN_LOGIN = { email: STAFF_EMAIL, password: PASSWORD, totpCode: '123456' };

const SIGNED_UP: MeResponse = {
  account: { email: EMAIL, role: 'diver' },
  diver: { id: DIVER_ID, firstName: 'Marine', lastName: null, level: null, avatarUrl: null },
  consent: null,
  currentPolicyVersion: '2026-11',
  onboarding: 'profile-required',
};

const SIGNED_IN: MeResponse = {
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

const INVALID_CREDENTIALS: ApiDomainErrorResponse = {
  statusCode: 401,
  code: 'invalid-credentials',
};
const TOO_MANY: ApiDomainErrorResponse = { statusCode: 429, code: 'too-many-attempts' };
const UNAUTHENTICATED: ApiDomainErrorResponse = { statusCode: 401, code: 'unauthenticated' };

function validationFailed(fieldErrors: Record<string, string[]>): ApiValidationErrorResponse {
  return { statusCode: 400, code: 'validation-failed', fieldErrors };
}

describe.each([
  { secureCookies: true, web: '__Host-edeep_sid', admin: '__Host-edeep_admin_sid' },
  { secureCookies: false, web: 'edeep_sid', admin: 'edeep_admin_sid' },
])('session cookies (SESSION_COOKIE_SECURE=$secureCookies)', ({ secureCookies, web, admin }) => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createAuthTestApp({ secureCookies });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(resetFakes);

  const server = () => request(app.getHttpServer());

  /** Attributes every session cookie carries, set or cleared. */
  function expectSessionAttributes(header: string | string[] | undefined, name: string) {
    const cookie = singleSetCookie(header);
    expect(cookie.name).toBe(name);
    expect(cookie.attributes.get('httponly')).toBe(true);
    expect(cookie.attributes.get('samesite')).toBe('Strict');
    expect(cookie.attributes.get('path')).toBe('/');
    expect(cookie.attributes.has('domain')).toBe(false);
    expect(cookie.attributes.get('secure')).toBe(secureCookies ? true : undefined);
    return cookie;
  }

  it('login with rememberMe: persistent cookie, Max-Age to the absolute expiry', async () => {
    fakes.authentication.loginDiver.mockResolvedValue({
      account: DIVER_ACCOUNT,
      session: PERSISTENT,
    });

    const response = await server().post('/api/auth/login').send(LOGIN).expect(200);

    const cookie = expectSessionAttributes(response.headers['set-cookie'], web);
    expect(cookie.value).toBe(NEW_TOKEN);
    expect(cookie.attributes.get('max-age')).toBe(PERSISTENT_MAX_AGE);
  });

  it('login without rememberMe: browser-session cookie, no Max-Age nor Expires', async () => {
    fakes.authentication.loginDiver.mockResolvedValue({ account: DIVER_ACCOUNT, session: SHORT });

    const response = await server()
      .post('/api/auth/login')
      .send({ ...LOGIN, rememberMe: false })
      .expect(200);

    const cookie = expectSessionAttributes(response.headers['set-cookie'], web);
    expect(cookie.attributes.has('max-age')).toBe(false);
    expect(cookie.attributes.has('expires')).toBe(false);
  });

  it('register: persistent web cookie', async () => {
    fakes.registration.register.mockResolvedValue({
      account: DIVER_ACCOUNT,
      diver: INCOMPLETE.diver,
      session: PERSISTENT,
    });
    fakes.onboarding.stateOf.mockResolvedValue(INCOMPLETE);

    const response = await server().post('/api/auth/register').send(REGISTER).expect(201);

    const cookie = expectSessionAttributes(response.headers['set-cookie'], web);
    expect(cookie.attributes.get('max-age')).toBe(PERSISTENT_MAX_AGE);
  });

  it('admin login: admin cookie, always a browser-session one', async () => {
    fakes.authentication.loginStaff.mockResolvedValue({ account: STAFF_ACCOUNT, session: SHORT });

    const response = await server().post('/api/admin/auth/login').send(ADMIN_LOGIN).expect(200);

    const cookie = expectSessionAttributes(response.headers['set-cookie'], admin);
    expect(cookie.value).toBe(NEW_TOKEN);
    expect(cookie.attributes.has('max-age')).toBe(false);
  });

  it.each([
    ['/api/auth/logout', web],
    ['/api/admin/auth/logout', admin],
  ])('%s clears its cookie with the same name and attributes', async (path, name) => {
    const response = await server().post(path).expect(204);

    const cookie = expectSessionAttributes(response.headers['set-cookie'], name);
    expect(cookie.value).toBe('');
    expect(cookie.attributes.get('expires')).toBe('Thu, 01 Jan 1970 00:00:00 GMT');
    expect(cookie.attributes.has('max-age')).toBe(false);
  });

  it('PUT /me/password: the rotated cookie keeps the attributes and the persistence', async () => {
    fakes.sessions.resolve.mockResolvedValue(DIVER_SESSION);
    fakes.accounts.changePassword.mockResolvedValue(PERSISTENT);

    const response = await server()
      .put('/api/me/password')
      .set('Cookie', `${web}=${TOKEN}`)
      .send({ currentPassword: PASSWORD, newPassword: 'night dive under the full moon' })
      .expect(204);

    const cookie = expectSessionAttributes(response.headers['set-cookie'], web);
    expect(cookie.value).toBe(NEW_TOKEN);
    expect(cookie.attributes.get('max-age')).toBe(PERSISTENT_MAX_AGE);
  });

  it.each([
    ['DELETE /api/me', 'delete', '/api/me'],
    ['POST /api/auth/logout-all', 'post', '/api/auth/logout-all'],
  ] as const)('%s clears the web cookie with the same attributes', async (_route, method, path) => {
    fakes.sessions.resolve.mockResolvedValue(DIVER_SESSION);
    fakes.accounts.deleteAccount.mockResolvedValue(undefined);

    const call = server()[method](path);
    const response = await call
      .set('Cookie', `${web}=${TOKEN}`)
      .send({ password: PASSWORD })
      .expect(204);

    const cookie = expectSessionAttributes(response.headers['set-cookie'], web);
    expect(cookie.value).toBe('');
    expect(cookie.attributes.get('expires')).toBe('Thu, 01 Jan 1970 00:00:00 GMT');
    expect(cookie.attributes.has('max-age')).toBe(false);
  });

  it('reads the cookie of its own name only', async () => {
    const otherName = secureCookies ? 'edeep_sid' : '__Host-edeep_sid';

    await server().post('/api/auth/logout').set('Cookie', `${otherName}=${TOKEN}`).expect(204);
    await server().post('/api/auth/logout').set('Cookie', `${web}=${TOKEN}`).expect(204);

    expect(fakes.authentication.signOut.mock.calls).toEqual([
      [[], 'web'],
      [[TOKEN], 'web'],
    ]);
  });
});

describe('/api/auth and /api/admin/auth (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createAuthTestApp({ secureCookies: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(resetFakes);

  const server = () => request(app.getHttpServer());

  describe('POST /api/auth/register', () => {
    it('201: signs the diver up and in, MeResponse with onboarding profile-required', async () => {
      fakes.registration.register.mockResolvedValue({
        account: DIVER_ACCOUNT,
        diver: INCOMPLETE.diver,
        session: PERSISTENT,
      });
      fakes.onboarding.stateOf.mockResolvedValue(INCOMPLETE);

      const response = await server().post('/api/auth/register').send(REGISTER).expect(201);

      expect(response.body).toStrictEqual(SIGNED_UP);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.text).not.toContain(NEW_TOKEN);
      // The rate-limit key is the normalised IP (IPv4-mapped loopback → IPv4).
      expect(fakes.registration.register).toHaveBeenCalledWith({
        ...REGISTER,
        ip: '127.0.0.1',
        replacedTokens: [],
      });
      expect(fakes.onboarding.stateOf).toHaveBeenCalledWith(DIVER_ID);
    });

    it('rotates: the web cookie already presented is handed over for revocation', async () => {
      fakes.registration.register.mockResolvedValue({
        account: DIVER_ACCOUNT,
        diver: INCOMPLETE.diver,
        session: PERSISTENT,
      });
      fakes.onboarding.stateOf.mockResolvedValue(INCOMPLETE);

      await server()
        .post('/api/auth/register')
        .set('Cookie', `edeep_sid=${TOKEN}; edeep_admin_sid=${OTHER_TOKEN}`)
        .send(REGISTER)
        .expect(201);

      expect(fakes.registration.register).toHaveBeenCalledWith(
        expect.objectContaining({ replacedTokens: [TOKEN] }),
      );
    });

    it('500 without a cookie when the answer cannot be built after sign-up', async () => {
      fakes.registration.register.mockResolvedValue({
        account: DIVER_ACCOUNT,
        diver: INCOMPLETE.diver,
        session: PERSISTENT,
      });
      fakes.onboarding.stateOf.mockRejectedValue(new Error('database down'));

      const response = await server().post('/api/auth/register').send(REGISTER).expect(500);

      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('403 registration-closed when the flag is off', async () => {
      fakes.registration.register.mockRejectedValue(new RegistrationClosedError());

      const response = await server().post('/api/auth/register').send(REGISTER).expect(403);

      expect(response.body).toStrictEqual({ statusCode: 403, code: 'registration-closed' });
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('409 email-taken, without the email', async () => {
      fakes.registration.register.mockRejectedValue(new EmailTakenError());

      const response = await server().post('/api/auth/register').send(REGISTER).expect(409);

      expect(response.body).toStrictEqual({ statusCode: 409, code: 'email-taken' });
      expect(response.text).not.toContain(EMAIL);
    });

    it('429 too-many-attempts with Retry-After', async () => {
      fakes.registration.register.mockRejectedValue(new TooManyAttemptsError(37));

      const response = await server().post('/api/auth/register').send(REGISTER).expect(429);

      expect(response.body).toStrictEqual(TOO_MANY);
      expect(response.headers['retry-after']).toBe('37');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('400 from the password policy, without the password', async () => {
      fakes.registration.register.mockRejectedValue(
        new DomainValidationError({ password: ['compromised', 'contains-identity'] }),
      );

      const response = await server().post('/api/auth/register').send(REGISTER).expect(400);

      expect(response.body).toStrictEqual(
        validationFailed({ password: ['compromised', 'contains-identity'] }),
      );
      expect(response.text).not.toContain(PASSWORD);
    });

    it.each<[string, Record<string, unknown>, Record<string, string[]>]>([
      [
        'every field missing',
        {},
        { firstName: ['required'], email: ['required'], password: ['required'] },
      ],
      ['a blank first name', { ...REGISTER, firstName: '   ' }, { firstName: ['length'] }],
      [
        'a first name of 41 characters',
        { ...REGISTER, firstName: `${MARKER}${'a'.repeat(27)}` },
        { firstName: ['length'] },
      ],
      ['an email that is not one', { ...REGISTER, email: MARKER }, { email: ['format'] }],
      [
        'an email of 255 characters',
        { ...REGISTER, email: `${MARKER}@${'a'.repeat(240)}.test` },
        { email: ['length'] },
      ],
      [
        'a password of 129 characters',
        { ...REGISTER, password: `${MARKER}${'p'.repeat(115)}` },
        { password: ['too-long'] },
      ],
      [
        'a password of 129 emoji (code points)',
        { ...REGISTER, password: '🐠'.repeat(129) },
        { password: ['too-long'] },
      ],
      ['a mistyped password', { ...REGISTER, password: 123 }, { password: ['type'] }],
      ['an unknown property', { ...REGISTER, role: 'admin' }, { role: ['unknown'] }],
    ])(
      '400 for %s, without calling the service nor echoing a value',
      async (_case, body, fieldErrors) => {
        const response = await server().post('/api/auth/register').send(body).expect(400);

        expect(response.body).toStrictEqual(validationFailed(fieldErrors));
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.text).not.toContain(MARKER);
        expect(fakes.registration.register).not.toHaveBeenCalled();
      },
    );

    it('accepts a password of exactly 128 characters', async () => {
      fakes.registration.register.mockResolvedValue({
        account: DIVER_ACCOUNT,
        diver: INCOMPLETE.diver,
        session: PERSISTENT,
      });

      await server()
        .post('/api/auth/register')
        .send({ ...REGISTER, password: 'p'.repeat(128) })
        .expect(201);
    });
  });

  describe('POST /api/auth/login', () => {
    it('200: MeResponse and a new cookie; the token is never in the body', async () => {
      fakes.authentication.loginDiver.mockResolvedValue({
        account: DIVER_ACCOUNT,
        session: PERSISTENT,
      });

      const response = await server().post('/api/auth/login').send(LOGIN).expect(200);

      expect(response.body).toStrictEqual(SIGNED_IN);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.text).not.toContain(NEW_TOKEN);
      expect(fakes.authentication.loginDiver).toHaveBeenCalledWith({
        ...LOGIN,
        ip: '127.0.0.1',
        replacedTokens: [],
      });
      expect(fakes.onboarding.stateOf).toHaveBeenCalledWith(DIVER_ID);
      // The email comes from the login result: no second read of the account.
      expect(fakes.accounts.identityOf).not.toHaveBeenCalled();
    });

    it('500 without a cookie when the answer cannot be built after the session was opened', async () => {
      fakes.authentication.loginDiver.mockResolvedValue({
        account: DIVER_ACCOUNT,
        session: PERSISTENT,
      });
      fakes.onboarding.stateOf.mockRejectedValue(new Error('database down'));

      const response = await server().post('/api/auth/login').send(LOGIN).expect(500);

      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.text).not.toContain(NEW_TOKEN);
    });

    it('rotates: the web cookies already presented are handed over for revocation', async () => {
      fakes.authentication.loginDiver.mockResolvedValue({
        account: DIVER_ACCOUNT,
        session: PERSISTENT,
      });

      const response = await server()
        .post('/api/auth/login')
        .set('Cookie', `edeep_sid=${TOKEN}; edeep_admin_sid=${OTHER_TOKEN}`)
        .send(LOGIN)
        .expect(200);

      expect(fakes.authentication.loginDiver).toHaveBeenCalledWith(
        expect.objectContaining({ replacedTokens: [TOKEN] }),
      );
      expect(singleSetCookie(response.headers['set-cookie']).value).toBe(NEW_TOKEN);
    });

    it('401: the same status and body for an unknown email and a wrong password', async () => {
      fakes.authentication.loginDiver.mockRejectedValue(new InvalidCredentialsError());

      const unknown = await server()
        .post('/api/auth/login')
        .send({ ...LOGIN, email: 'nobody@example.test' })
        .expect(401);
      const wrong = await server()
        .post('/api/auth/login')
        .send({ ...LOGIN, password: `${MARKER} wrong password` })
        .expect(401);

      expect(unknown.body).toStrictEqual(INVALID_CREDENTIALS);
      expect(wrong.body).toStrictEqual(unknown.body);
      expect(wrong.text).toBe(unknown.text);
      expect(unknown.text).not.toContain('nobody');
      expect(wrong.text).not.toContain(MARKER);
      expect(unknown.headers['cache-control']).toBe('no-store');
      expect(setCookies(unknown.headers['set-cookie'])).toEqual([]);
    });

    it('429 too-many-attempts with Retry-After', async () => {
      fakes.authentication.loginDiver.mockRejectedValue(new TooManyAttemptsError(120));

      const response = await server().post('/api/auth/login').send(LOGIN).expect(429);

      expect(response.body).toStrictEqual(TOO_MANY);
      expect(response.headers['retry-after']).toBe('120');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('400 for an email the accounts cannot hold (normalizeEmail), without echoing it', async () => {
      fakes.authentication.loginDiver.mockRejectedValue(
        new DomainValidationError({ email: ['invalid-character'] }),
      );

      const response = await server()
        .post('/api/auth/login')
        .send({ ...LOGIN, email: 'é@example.test' })
        .expect(400);

      expect(response.body).toStrictEqual(validationFailed({ email: ['invalid-character'] }));
      expect(response.text).not.toContain('example.test');
    });

    it.each<[string, Record<string, unknown>, Record<string, string[]>]>([
      ['a missing rememberMe', { rememberMe: undefined }, { rememberMe: ['required'] }],
      ['a mistyped rememberMe', { rememberMe: 'yes' }, { rememberMe: ['type'] }],
      ['a missing email', { email: undefined }, { email: ['required'] }],
      ['an email that is not one', { email: `${MARKER}@` }, { email: ['format'] }],
      [
        'a password of 129 characters',
        { password: `${MARKER}${'p'.repeat(115)}` },
        { password: ['too-long'] },
      ],
      ['a missing password', { password: undefined }, { password: ['required'] }],
    ])('400 for %s, without calling the service', async (_case, patch, fieldErrors) => {
      const response = await server()
        .post('/api/auth/login')
        .send({ ...LOGIN, ...patch })
        .expect(400);

      expect(response.body).toStrictEqual(validationFailed(fieldErrors));
      expect(response.text).not.toContain(MARKER);
      expect(fakes.authentication.loginDiver).not.toHaveBeenCalled();
    });

    it('400 for a malformed JSON body, without echoing it', async () => {
      const response = await server()
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send(`{"email": "${MARKER}", `)
        .expect(400);

      expect(response.text).not.toContain(MARKER);
      expect(fakes.authentication.loginDiver).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('204 and a cleared cookie without any cookie (idempotent)', async () => {
      const response = await server().post('/api/auth/logout').expect(204);

      expect(response.text).toBe('');
      expect(response.headers['cache-control']).toBe('no-store');
      expect(singleSetCookie(response.headers['set-cookie']).value).toBe('');
      expect(fakes.authentication.signOut).toHaveBeenCalledWith([], 'web');
    });

    it('204 with an unknown cookie, which is handed over to be revoked', async () => {
      await server().post('/api/auth/logout').set('Cookie', `edeep_sid=${TOKEN}`).expect(204);
      await server().post('/api/auth/logout').set('Cookie', `edeep_sid=${TOKEN}`).expect(204);

      expect(fakes.authentication.signOut).toHaveBeenNthCalledWith(2, [TOKEN], 'web');
    });

    it('never ends an admin session', async () => {
      await server().post('/api/auth/logout').set('Cookie', `edeep_admin_sid=${TOKEN}`).expect(204);

      expect(fakes.authentication.signOut).toHaveBeenCalledWith([], 'web');
    });
  });

  describe('POST /api/auth/logout-all', () => {
    it('204: every session of the account ended, the cookie cleared', async () => {
      fakes.sessions.resolve.mockResolvedValue(DIVER_SESSION);

      const response = await server()
        .post('/api/auth/logout-all')
        .set('Cookie', `edeep_sid=${TOKEN}`)
        .expect(204);

      expect(fakes.sessions.resolve).toHaveBeenCalledWith(TOKEN, 'web');
      expect(fakes.sessions.touch).toHaveBeenCalledWith(DIVER_SESSION);
      expect(fakes.authentication.signOutEverywhere).toHaveBeenCalledWith(ACCOUNT_ID);
      expect(singleSetCookie(response.headers['set-cookie']).value).toBe('');
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('500 keeps the cookie when the sessions could not be revoked', async () => {
      fakes.sessions.resolve.mockResolvedValue(DIVER_SESSION);
      fakes.authentication.signOutEverywhere.mockRejectedValue(new Error('database down'));

      const response = await server()
        .post('/api/auth/logout-all')
        .set('Cookie', `edeep_sid=${TOKEN}`)
        .expect(500);

      expect(response.headers['set-cookie']).toBeUndefined();
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it.each([
      ['without a cookie', undefined],
      ['with an unknown cookie', `edeep_sid=${TOKEN}`],
      ['with the admin cookie', `edeep_admin_sid=${TOKEN}`],
    ])('401 unauthenticated %s', async (_case, cookie) => {
      const call = server().post('/api/auth/logout-all');
      const response = await (cookie === undefined ? call : call.set('Cookie', cookie)).expect(401);

      expect(response.body).toStrictEqual(UNAUTHENTICATED);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(fakes.authentication.signOutEverywhere).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/auth/login', () => {
    it('200: AdminMeResponse and the admin cookie; the admin cookie presented is rotated', async () => {
      fakes.authentication.loginStaff.mockResolvedValue({ account: STAFF_ACCOUNT, session: SHORT });

      const response = await server()
        .post('/api/admin/auth/login')
        .set('Cookie', `edeep_sid=${OTHER_TOKEN}; edeep_admin_sid=${TOKEN}`)
        .send(ADMIN_LOGIN)
        .expect(200);

      expect(response.body).toStrictEqual({
        account: { email: STAFF_EMAIL, role: 'support' },
      } satisfies AdminMeResponse);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(fakes.authentication.loginStaff).toHaveBeenCalledWith({
        ...ADMIN_LOGIN,
        ip: '127.0.0.1',
        replacedTokens: [TOKEN],
      });
    });

    it('401 invalid-credentials (wrong password or role), same body as the web', async () => {
      fakes.authentication.loginStaff.mockRejectedValue(new InvalidCredentialsError());

      const response = await server().post('/api/admin/auth/login').send(ADMIN_LOGIN).expect(401);

      expect(response.body).toStrictEqual(INVALID_CREDENTIALS);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('429 too-many-attempts with Retry-After', async () => {
      fakes.authentication.loginStaff.mockRejectedValue(new TooManyAttemptsError(5));

      const response = await server().post('/api/admin/auth/login').send(ADMIN_LOGIN).expect(429);

      expect(response.body).toStrictEqual(TOO_MANY);
      expect(response.headers['retry-after']).toBe('5');
    });

    it.each<[string, Record<string, unknown>, Record<string, string[]>]>([
      ['a missing TOTP code', { totpCode: undefined }, { totpCode: ['required'] }],
      ['a TOTP code of 5 digits', { totpCode: '12345' }, { totpCode: ['format'] }],
      ['a TOTP code with a letter', { totpCode: `${MARKER}1` }, { totpCode: ['format'] }],
      ['a numeric TOTP code', { totpCode: 123456 }, { totpCode: ['type'] }],
      [
        'a rememberMe (staff sessions are always short)',
        { rememberMe: true },
        { rememberMe: ['unknown'] },
      ],
      ['an email that is not one', { email: MARKER }, { email: ['format'] }],
      ['a password of 129 characters', { password: 'p'.repeat(129) }, { password: ['too-long'] }],
    ])('400 for %s, without calling the service', async (_case, patch, fieldErrors) => {
      const response = await server()
        .post('/api/admin/auth/login')
        .send({ ...ADMIN_LOGIN, ...patch })
        .expect(400);

      expect(response.body).toStrictEqual(validationFailed(fieldErrors));
      expect(response.text).not.toContain(MARKER);
      expect(fakes.authentication.loginStaff).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/admin/auth/logout', () => {
    it('204 idempotent, ends the admin cookie only', async () => {
      await server().post('/api/admin/auth/logout').expect(204);
      const response = await server()
        .post('/api/admin/auth/logout')
        .set('Cookie', `edeep_sid=${OTHER_TOKEN}; edeep_admin_sid=${TOKEN}`)
        .expect(204);

      expect(response.headers['cache-control']).toBe('no-store');
      expect(fakes.authentication.signOut.mock.calls).toEqual([
        [[], 'admin'],
        [[TOKEN], 'admin'],
      ]);
    });
  });
});

describe('client IP key behind a trusted proxy (trustProxy: 1)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createAuthTestApp({ secureCookies: false, trustProxy: 1 });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(resetFakes);

  it.each([
    ['an IPv4 client', '198.51.100.4', '198.51.100.4'],
    ['an IPv4-mapped client', '::ffff:198.51.100.4', '198.51.100.4'],
    ['an IPv6 client, keyed by its /64', '2001:db8:0:1:aaaa::5', '2001:db8:0:1::/64'],
  ])('the throttle receives the normalised key of %s', async (_case, forwarded, key) => {
    fakes.authentication.loginDiver.mockRejectedValue(new InvalidCredentialsError());

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', `203.0.113.99, ${forwarded}`)
      .send(LOGIN)
      .expect(401);

    expect(fakes.authentication.loginDiver).toHaveBeenCalledWith(
      expect.objectContaining({ ip: key }),
    );
  });
});
