import { request as httpRequest } from 'node:http';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { WEB_COOKIE, sameOrigin, signIn } from './support/access-control';
import { createAuthTestApp, fakes, resetFakes } from './support/auth-app';

// The global `JsonBodyGuard` (D34) through the real pipeline: on an unsafe method, a body must be
// JSON; a request without a body is accepted; safe methods are never checked.

const UNSUPPORTED = { statusCode: 415, code: 'unsupported-media-type' };
const MARKER = 'zq-body-marker';

describe('JsonBodyGuard (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await createAuthTestApp({ secureCookies: false });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(resetFakes);

  it.each([
    ['a form (urlencoded)', 'application/x-www-form-urlencoded', `email=${MARKER}&password=x`],
    ['text/plain', 'text/plain', `{"email":"${MARKER}"}`],
    ['a multipart form', 'multipart/form-data; boundary=x', `--x\r\n${MARKER}\r\n--x--`],
    ['JSON look-alike', 'application/jsonp', `{"email":"${MARKER}"}`],
  ])('415 for %s, generic and no-store, nothing done', async (_case, contentType, body) => {
    const response = await sameOrigin(app)
      .post('/api/auth/login')
      .set('Content-Type', contentType)
      .send(body)
      .expect(415);

    expect(response.body).toStrictEqual(UNSUPPORTED);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.text).not.toContain(MARKER);
    expect(fakes.authentication.loginDiver).not.toHaveBeenCalled();
  });

  it('415 for a body without any Content-Type', async () => {
    const response = await sameOrigin(app)
      .post('/api/auth/login')
      .set('Content-Length', String(MARKER.length))
      .unset('Content-Type')
      .send(Buffer.from(MARKER))
      .expect(415);

    expect(response.body).toStrictEqual(UNSUPPORTED);
  });

  it('415 for a chunked body that is not JSON (Transfer-Encoding, no Content-Length)', async () => {
    signIn();
    // supertest always sets a Content-Length: a raw request streams the body in chunks instead.
    const server = app.getHttpServer().listen(0);
    try {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      const status = await new Promise<number | undefined>((resolve, reject) => {
        const outgoing = httpRequest(
          {
            port,
            method: 'PUT',
            path: '/api/me/password',
            headers: {
              Cookie: WEB_COOKIE,
              'Content-Type': 'text/plain',
              'Sec-Fetch-Site': 'same-origin',
            },
          },
          (incoming) => {
            incoming.resume();
            resolve(incoming.statusCode);
          },
        );
        outgoing.on('error', reject);
        outgoing.write(MARKER);
        outgoing.end();
      });

      expect(status).toBe(415);
      expect(fakes.sessions.resolve).not.toHaveBeenCalled();
    } finally {
      // Awaited: supertest reuses a server that is still listening.
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it.each([
    'application/json; charset=utf-8',
    'Application/JSON',
    'application/json;charset=UTF-8',
  ])('accepts %s', async (contentType) => {
    fakes.authentication.signOut.mockResolvedValue(undefined);

    await sameOrigin(app)
      .post('/api/auth/logout')
      .set('Content-Type', contentType)
      .send('{}')
      .expect(204);
  });

  it('accepts a POST without a body, whatever its Content-Type', async () => {
    await sameOrigin(app).post('/api/auth/logout').expect(204);
    await sameOrigin(app).post('/api/auth/logout').set('Content-Type', 'text/plain').expect(204);
  });

  it('does not check a GET', async () => {
    fakes.levels.findActive.mockResolvedValue([]);

    await sameOrigin(app)
      .get('/api/certification-levels')
      .set('Content-Type', 'text/plain')
      .expect(200);
  });
});
