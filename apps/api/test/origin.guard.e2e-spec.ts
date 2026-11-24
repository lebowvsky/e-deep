import type { ApiDomainErrorResponse } from '@e-deep/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { WEB_COOKIE, WEB_ORIGIN, signIn } from './support/access-control';
import { createAuthTestApp, fakes, resetFakes } from './support/auth-app';

// The global `OriginGuard` (CSRF, D34) through the real pipeline: on an unsafe method, the request
// must come from one of our pages (`Sec-Fetch-Site: same-origin`); only without that header does an
// `Origin` of `ALLOWED_ORIGINS` (here `http://localhost:5173`) stand in. Safe methods are never
// checked.

const FORBIDDEN: ApiDomainErrorResponse = { statusCode: 403, code: 'forbidden' };

describe('OriginGuard (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createAuthTestApp({ secureCookies: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(resetFakes);

  const logout = () => request(app.getHttpServer()).post('/api/auth/logout');

  describe('accepted on an unsafe method', () => {
    it.each<[string, Record<string, string>]>([
      ['Sec-Fetch-Site: same-origin', { 'Sec-Fetch-Site': 'same-origin' }],
      ['an allowed Origin without Sec-Fetch-Site (older browser)', { Origin: WEB_ORIGIN }],
      [
        'Sec-Fetch-Site: same-origin with a foreign Origin (the fetch metadata decides)',
        { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'same-origin' },
      ],
    ])('%s', async (_case, headers) => {
      await logout().set(headers).expect(204);

      expect(fakes.authentication.signOut).toHaveBeenCalled();
    });
  });

  describe('refused on an unsafe method: 403 forbidden, no-store, nothing done', () => {
    it.each<[string, Record<string, string>]>([
      ['neither Origin nor Sec-Fetch-Site', {}],
      ['Sec-Fetch-Site: cross-site', { 'Sec-Fetch-Site': 'cross-site' }],
      ['Sec-Fetch-Site: same-site (another subdomain)', { 'Sec-Fetch-Site': 'same-site' }],
      ['Sec-Fetch-Site: none (typed in the address bar)', { 'Sec-Fetch-Site': 'none' }],
      ['an Origin that is not allowed', { Origin: 'https://evil.example' }],
      ['an allowed Origin with a trailing slash', { Origin: `${WEB_ORIGIN}/` }],
      ['the opaque Origin null', { Origin: 'null' }],
      [
        'a disallowed Origin with a cross-site Sec-Fetch-Site',
        { Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' },
      ],
      // Present, `Sec-Fetch-Site` alone decides: an allowed Origin does not stand in for it.
      [
        'an allowed Origin with a cross-site Sec-Fetch-Site',
        { Origin: WEB_ORIGIN, 'Sec-Fetch-Site': 'cross-site' },
      ],
      [
        'an allowed Origin with a same-site Sec-Fetch-Site',
        { Origin: WEB_ORIGIN, 'Sec-Fetch-Site': 'same-site' },
      ],
    ])('%s', async (_case, headers) => {
      const response = await logout().set(headers).expect(403);

      expect(response.body).toStrictEqual(FORBIDDEN);
      expect(response.headers['cache-control']).toBe('no-store');
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(fakes.authentication.signOut).not.toHaveBeenCalled();
    });

    it.each<['post' | 'put' | 'delete', string]>([
      ['post', '/api/auth/login'],
      ['post', '/api/auth/register'],
      ['post', '/api/admin/auth/login'],
      ['post', '/api/me/consents'],
      ['put', '/api/me/password'],
      ['delete', '/api/me'],
    ])('%s %s, before any session is read', async (method, path) => {
      signIn();

      const agent = request(app.getHttpServer());
      const response = await agent[method](path).set('Cookie', WEB_COOKIE).send({}).expect(403);

      expect(response.body).toStrictEqual(FORBIDDEN);
      expect(fakes.sessions.resolve).not.toHaveBeenCalled();
      expect(fakes.sessions.touch).not.toHaveBeenCalled();
    });
  });

  describe('safe methods are not checked', () => {
    it('GET of a public route from another site', async () => {
      fakes.levels.findActive.mockResolvedValue([]);

      await request(app.getHttpServer())
        .get('/api/certification-levels')
        .set('Sec-Fetch-Site', 'cross-site')
        .set('Origin', 'https://evil.example')
        .expect(200);
    });

    it('GET of a session route without any origin header goes to the session check', async () => {
      signIn();

      await request(app.getHttpServer()).get('/api/me').set('Cookie', WEB_COOKIE).expect(200);
      expect(fakes.sessions.resolve).toHaveBeenCalled();
    });
  });
});
