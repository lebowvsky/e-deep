// First: the environment of `AppModule` (see the file).
import { restoreEnvironment } from './support/app-environment';
import { randomUUID } from 'node:crypto';
import type {
  CertificationLevelListResponse,
  DiveWriteBuddy,
  MeResponse,
  SiteResponse,
} from '@e-deep/shared';
import { DiscoveryModule } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { createStaffAccountCommand } from '../../src/cli/create-staff-account';
import { configureApp } from '../../src/configure-app';
import { AccountProvisioningService } from '../../src/modules/accounts/account-provisioning.service';
import { diveWriteRequest } from '../support/dive-write-request';
import {
  SUPERTEST_METHODS,
  hasErrorCode,
  inventoryRoutes,
  type RouteMethod,
} from '../support/route-inventory';
import { siteCreateRequest } from '../support/site-request';
import { selectRows } from './support/sql';
import { resetDatabase } from './support/test-database';

// Cross-cutting authorization tests (docs/plans/auth.md §7): the whole `AppModule` on the `_test`
// database, through `configureApp`, with real accounts. A and B sign up and complete `/welcome`
// through the API, C signs up only, the staff S is created by the `account:create-staff` command
// (its code path, without stdin). B owns a dive, a site and a buddy.
//
// The matrix below is checked against the route inventory: a route without an entry (or an entry
// without a route) fails the suite.

const PASSWORD = 'tidal lantern 1987 quietly';
const STAFF_PASSWORD = 'harbour signal 2031 slowly';
const EMAILS = {
  a: 'alpha@example.test',
  b: 'bravo@example.test',
  c: 'charlie@example.test',
  s: 'sierra@example.test',
};
const B_SITE_NAME = 'Bravo private reef';
const B_BUDDY_LAST_NAME = 'Bravobuddy';

type RouteKind = 'public' | 'logbook' | 'account' | 'admin';

/** Ids the matrix paths are built from (B's resources, or A's own site). */
interface Ids {
  readonly diveB: string;
  readonly siteB: string;
}

interface MatrixEntry {
  readonly kind: RouteKind;
  readonly path: (ids: Ids) => string;
}

const fixed = (path: string) => (): string => path;

/** Every route of the application, by kind. Must match the inventory exactly. */
const MATRIX: Readonly<Record<string, MatrixEntry>> = {
  'GET /api/health': { kind: 'public', path: fixed('/api/health') },
  'GET /api/certification-levels': { kind: 'public', path: fixed('/api/certification-levels') },
  'POST /api/auth/register': { kind: 'public', path: fixed('/api/auth/register') },
  'POST /api/auth/login': { kind: 'public', path: fixed('/api/auth/login') },
  'POST /api/auth/logout': { kind: 'public', path: fixed('/api/auth/logout') },
  'POST /api/admin/auth/login': { kind: 'public', path: fixed('/api/admin/auth/login') },
  'POST /api/admin/auth/logout': { kind: 'public', path: fixed('/api/admin/auth/logout') },
  'GET /api/admin/me': { kind: 'admin', path: fixed('/api/admin/me') },
  'GET /api/me': { kind: 'account', path: fixed('/api/me') },
  'POST /api/me/onboarding': { kind: 'account', path: fixed('/api/me/onboarding') },
  'POST /api/me/consents': { kind: 'account', path: fixed('/api/me/consents') },
  'PUT /api/me/password': { kind: 'account', path: fixed('/api/me/password') },
  'DELETE /api/me': { kind: 'account', path: fixed('/api/me') },
  // Last of the account routes: it ends every session of the caller.
  'POST /api/auth/logout-all': { kind: 'account', path: fixed('/api/auth/logout-all') },
  'GET /api/dashboard': { kind: 'logbook', path: fixed('/api/dashboard') },
  'GET /api/dives': { kind: 'logbook', path: fixed('/api/dives') },
  'GET /api/dives/:id': { kind: 'logbook', path: ({ diveB }) => `/api/dives/${diveB}` },
  'POST /api/dives': { kind: 'logbook', path: fixed('/api/dives') },
  'PUT /api/dives/:id': { kind: 'logbook', path: ({ diveB }) => `/api/dives/${diveB}` },
  'GET /api/sites': { kind: 'logbook', path: fixed('/api/sites') },
  'GET /api/sites/:id': { kind: 'logbook', path: ({ siteB }) => `/api/sites/${siteB}` },
  'POST /api/sites': { kind: 'logbook', path: fixed('/api/sites') },
  'PUT /api/sites/:id': { kind: 'logbook', path: ({ siteB }) => `/api/sites/${siteB}` },
  'POST /api/sites/:id/merge': {
    kind: 'logbook',
    path: ({ siteB }) => `/api/sites/${siteB}/merge`,
  },
  'DELETE /api/sites/:id': { kind: 'logbook', path: ({ siteB }) => `/api/sites/${siteB}` },
};

const routesOf = (...kinds: RouteKind[]): [string][] =>
  Object.entries(MATRIX)
    .filter(([, entry]) => kinds.includes(entry.kind))
    .map(([key]) => [key]);

function methodOf(key: string): RouteMethod {
  const [method] = key.split(' ');
  const known = (['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const).find((m) => m === method);
  if (known === undefined) {
    throw new Error(`Unknown method in ${key}`);
  }
  return known;
}

/** `name=value` of the `Set-Cookie` called `name`, to send back. */
function cookieOf(response: Response, name: string): string {
  const header: unknown = response.headers['set-cookie'];
  const lines = Array.isArray(header) ? header.filter((line) => typeof line === 'string') : [];
  const line = lines.find((candidate) => candidate.startsWith(`${name}=`));
  if (line === undefined) {
    throw new Error(`No ${name} cookie`);
  }
  return line.split(';')[0] ?? '';
}

describe('authorization matrix (db)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  const ids = { diveB: '', siteB: '', siteA: '', buddyB: '', diverA: '', diverB: '' };
  const cookies = { a: '', b: '', c: '', s: '' };
  let levelId = '';

  const server = () => request(app.getHttpServer());
  /** A same-origin browser request of `key`, with `cookie` (none when `undefined`). */
  const callRoute = (key: string, cookie: string | undefined, body: object = {}) => {
    const entry = MATRIX[key];
    if (entry === undefined) {
      throw new Error(`No matrix entry for ${key}`);
    }
    const agent = server();
    const test = agent[SUPERTEST_METHODS[methodOf(key)]](entry.path(ids)).set(
      'Sec-Fetch-Site',
      'same-origin',
    );
    return (cookie === undefined ? test : test.set('Cookie', cookie)).send(body);
  };
  const as = (cookie: string) => ({
    get: (path: string) => server().get(path).set('Cookie', cookie),
    post: (path: string, body: object = {}) =>
      server().post(path).set('Cookie', cookie).set('Sec-Fetch-Site', 'same-origin').send(body),
    put: (path: string, body: object) =>
      server().put(path).set('Cookie', cookie).set('Sec-Fetch-Site', 'same-origin').send(body),
    delete: (path: string, body: object = {}) =>
      server().delete(path).set('Cookie', cookie).set('Sec-Fetch-Site', 'same-origin').send(body),
  });

  async function register(firstName: string, email: string): Promise<string> {
    const response = await server()
      .post('/api/auth/register')
      .set('Sec-Fetch-Site', 'same-origin')
      .send({ firstName, email, password: PASSWORD })
      .expect(201);
    return cookieOf(response, 'edeep_sid');
  }

  async function onboard(cookie: string, lastName: string): Promise<MeResponse> {
    const response = await as(cookie)
      .post('/api/me/onboarding', {
        lastName,
        certificationLevelId: levelId,
        healthDataConsent: true,
        policyVersion: '2026-11',
      })
      .expect(200);
    const me = response.body as MeResponse;
    expect(me.onboarding).toBe('complete');
    return me;
  }

  /** Everything B owns, as stored: a write of A must leave it identical. */
  async function stateOfB(): Promise<unknown> {
    return {
      sites: await selectRows(
        dataSource,
        `SELECT id, name, deleted_at, merged_into_id, updated_at::text
           FROM dive_sites WHERE owner_id = $1 ORDER BY id`,
        [ids.diverB],
      ),
      dives: await selectRows(
        dataSource,
        `SELECT e.id, e.site_id, e.deleted_at, e.updated_at::text, p.max_depth_m, p.updated_at::text AS p_updated_at
           FROM dive_events e JOIN dive_participations p ON p.dive_event_id = e.id
          WHERE p.diver_id = $1 ORDER BY e.id`,
        [ids.diverB],
      ),
      buddies: await selectRows(
        dataSource,
        'SELECT id, last_name, deleted_at, updated_at::text FROM buddies WHERE owner_id = $1 ORDER BY id',
        [ids.diverB],
      ),
    };
  }

  async function countOf(table: string, ownerColumn: string, ownerId: string): Promise<number> {
    const [row] = await selectRows<{ count: number }>(
      dataSource,
      `SELECT count(*)::int AS count FROM ${table} WHERE ${ownerColumn} = $1`,
      [ownerId],
    );
    return row?.count ?? 0;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, { trustProxy: 0 });
    await app.init();
    // The app's own pool, on the `_test` database (`app-environment.ts`), for the SQL checks.
    dataSource = app.get(DataSource);
    await resetDatabase(dataSource);

    const levels = await server().get('/api/certification-levels').expect(200);
    levelId = (levels.body as CertificationLevelListResponse).levels[0]?.id ?? '';

    cookies.a = await register('Alpha', EMAILS.a);
    cookies.b = await register('Bravo', EMAILS.b);
    cookies.c = await register('Charlie', EMAILS.c);
    ids.diverA = (await onboard(cookies.a, 'Anders')).diver.id;
    ids.diverB = (await onboard(cookies.b, 'Brandt')).diver.id;

    await createStaffAccountCommand(
      app.get(AccountProvisioningService),
      ['support', EMAILS.s],
      () => Promise.resolve(STAFF_PASSWORD),
    );
    const staffLogin = await server()
      .post('/api/admin/auth/login')
      .set('Sec-Fetch-Site', 'same-origin')
      .send({ email: EMAILS.s, password: STAFF_PASSWORD, totpCode: '000000' })
      .expect(200);
    cookies.s = cookieOf(staffLogin, 'edeep_admin_sid');

    const siteB = siteCreateRequest({ name: B_SITE_NAME });
    await as(cookies.b).post('/api/sites', siteB).expect(201);
    ids.siteB = siteB.id;
    const buddyB: DiveWriteBuddy = {
      id: randomUUID(),
      firstName: 'Bob',
      lastName: B_BUDDY_LAST_NAME,
      levelCode: null,
      isNew: true,
    };
    const diveB = diveWriteRequest({ event: { siteId: siteB.id }, buddies: [buddyB] });
    await as(cookies.b).post('/api/dives', diveB).expect(201);
    ids.diveB = diveB.event.id;
    ids.buddyB = buddyB.id;

    const siteA = siteCreateRequest({ name: 'Alpha own reef' });
    await as(cookies.a).post('/api/sites', siteA).expect(201);
    ids.siteA = siteA.id;
  });

  afterAll(async () => {
    await app?.close();
    restoreEnvironment();
  });

  it('has exactly one entry per route of the inventory', () => {
    const inventory = inventoryRoutes(app);

    expect(Object.keys(MATRIX).sort()).toEqual(inventory.map((route) => route.key));
    for (const route of inventory) {
      expect([route.key, MATRIX[route.key]?.kind === 'public']).toEqual([
        route.key,
        route.isPublic,
      ]);
    }
  });

  describe('without a cookie', () => {
    it.each(routesOf('logbook', 'account', 'admin'))('%s: 401', async (key) => {
      const response = await callRoute(key, undefined).expect(401);

      expect(hasErrorCode(response.body, 'unauthenticated')).toBe(true);
      expect(response.headers['cache-control']).toBe('no-store');
    });
  });

  describe('wrong audience', () => {
    it.each(routesOf('logbook', 'account'))('S (admin cookie) on %s: 401', async (key) => {
      await callRoute(key, cookies.s).expect(401);
    });

    it.each(routesOf('admin'))('A (web cookie) on %s: 401', async (key) => {
      await callRoute(key, cookies.a).expect(401);
      // The web token presented under the admin cookie name is no admin session either.
      await callRoute(key, cookies.a.replace(/^edeep_sid=/, 'edeep_admin_sid=')).expect(401);
    });

    it('S on its own audience: 200', async () => {
      await callRoute('GET /api/admin/me', cookies.s).expect(200);
    });
  });

  describe('A on the resources of B', () => {
    let initialB: unknown;

    beforeAll(async () => {
      initialB = await stateOfB();
    });

    afterEach(async () => {
      expect(await stateOfB()).toEqual(initialB);
    });

    it.each([
      ['dives', () => ids.diveB],
      ['sites', () => ids.siteB],
    ])('GET /api/%s/:idB: the same generic 404 as an unknown id', async (resource, idB) => {
      const foreign = await as(cookies.a).get(`/api/${resource}/${idB()}`).expect(404);
      const unknown = await as(cookies.a).get(`/api/${resource}/${randomUUID()}`).expect(404);

      expect(foreign.body).toStrictEqual(unknown.body);
    });

    it('PUT /api/dives/:idB: 404', async () => {
      const body = diveWriteRequest({ event: { id: ids.diveB, siteId: ids.siteA } });

      await as(cookies.a).put(`/api/dives/${ids.diveB}`, body).expect(404);
    });

    it('PUT /api/sites/:idB: 404', async () => {
      const { createdVia: _origin, ...replacement } = siteCreateRequest({ id: ids.siteB });

      await as(cookies.a).put(`/api/sites/${ids.siteB}`, replacement).expect(404);
    });

    it('DELETE /api/sites/:idB: 404', async () => {
      await as(cookies.a).delete(`/api/sites/${ids.siteB}`).expect(404);
    });

    it('POST /api/sites/:idB/merge: 404', async () => {
      await as(cookies.a)
        .post(`/api/sites/${ids.siteB}/merge`, { targetId: ids.siteA })
        .expect(404);
    });

    it('POST /api/sites/:idA/merge into B’s site: 422 invalid-reference', async () => {
      const response = await as(cookies.a)
        .post(`/api/sites/${ids.siteA}/merge`, { targetId: ids.siteB })
        .expect(422);

      expect(hasErrorCode(response.body, 'invalid-reference')).toBe(true);
    });

    it.each([
      ['the site of B', () => diveWriteRequest({ event: { siteId: ids.siteB } })],
      [
        'a buddy of B',
        () =>
          diveWriteRequest({
            event: { siteId: ids.siteA },
            buddies: [
              {
                id: ids.buddyB,
                firstName: 'Bob',
                lastName: B_BUDDY_LAST_NAME,
                levelCode: null,
                isNew: false,
              },
            ],
          }),
      ],
    ])(
      'POST /api/dives referencing %s: 422 invalid-reference, nothing written',
      async (_case, body) => {
        const response = await as(cookies.a).post('/api/dives', body()).expect(422);

        expect(hasErrorCode(response.body, 'invalid-reference')).toBe(true);
        expect(await countOf('dive_events', 'creator_id', ids.diverA)).toBe(0);
      },
    );

    it('POST /api/dives under the id of B’s dive: 409 identifier-conflict', async () => {
      const body = diveWriteRequest({ event: { id: ids.diveB, siteId: ids.siteA } });

      const response = await as(cookies.a).post('/api/dives', body).expect(409);

      expect(hasErrorCode(response.body, 'identifier-conflict')).toBe(true);
    });

    it('POST /api/sites under the id of B’s site: 409 identifier-conflict', async () => {
      const response = await as(cookies.a)
        .post('/api/sites', siteCreateRequest({ id: ids.siteB }))
        .expect(409);

      expect(hasErrorCode(response.body, 'identifier-conflict')).toBe(true);
    });

    it.each(['/api/dives', '/api/sites', '/api/dashboard'])(
      'GET %s: nothing of B (ids, names, counts)',
      async (path) => {
        const response = await as(cookies.a).get(path).expect(200);

        for (const marker of [ids.diveB, ids.siteB, ids.buddyB, ids.diverB, B_SITE_NAME]) {
          expect(response.text).not.toContain(marker);
        }
        expect(response.text).not.toContain(B_BUDDY_LAST_NAME);
      },
    );

    it('GET /api/sites of A lists its own site only', async () => {
      const response = await as(cookies.a).get('/api/sites').expect(200);

      expect((response.body as { sites: SiteResponse[] }).sites.map((site) => site.id)).toEqual([
        ids.siteA,
      ]);
    });
  });

  describe('C, signed up without /welcome', () => {
    it.each(routesOf('logbook'))('%s: 403 onboarding-required', async (key) => {
      const response = await callRoute(key, cookies.c).expect(403);

      expect(hasErrorCode(response.body, 'onboarding-required')).toBe(true);
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('reaches every account route (none answers 401 nor 403)', async () => {
      const statuses: Record<string, number> = {};
      for (const [key] of routesOf('account')) {
        statuses[key] = (await callRoute(key, cookies.c)).status;
      }

      expect(statuses).toEqual({
        'GET /api/me': 200,
        // Empty bodies: the DTO answers, past the guard.
        'POST /api/me/onboarding': 400,
        'POST /api/me/consents': 400,
        'PUT /api/me/password': 400,
        'DELETE /api/me': 400,
        'POST /api/auth/logout-all': 204,
      });
      // `logout-all` ended the session.
      await callRoute('GET /api/me', cookies.c).expect(401);
    });

    it('signs in again, completes /welcome (200), then reaches the dive log', async () => {
      const login = await server()
        .post('/api/auth/login')
        .set('Sec-Fetch-Site', 'same-origin')
        .send({ email: EMAILS.c, password: PASSWORD, rememberMe: true })
        .expect(200);
      cookies.c = cookieOf(login, 'edeep_sid');

      await onboard(cookies.c, 'Chen');

      await as(cookies.c).get('/api/dashboard').expect(200);
      await as(cookies.c).get('/api/dives').expect(200);
    });
  });

  describe('A without a consent at the current policy version', () => {
    beforeAll(async () => {
      // An older version, granted before the current one (its text changed since).
      await dataSource.query(
        'UPDATE consents SET withdrawn_at = now() WHERE diver_id = $1 AND withdrawn_at IS NULL',
        [ids.diverA],
      );
      await dataSource.query(
        `INSERT INTO consents (diver_id, purpose, policy_version) VALUES ($1, 'health_data_processing', '2025-01')`,
        [ids.diverA],
      );
    });

    it.each(routesOf('logbook'))('%s: 403 consent-required', async (key) => {
      const response = await callRoute(key, cookies.a).expect(403);

      expect(hasErrorCode(response.body, 'consent-required')).toBe(true);
    });

    it('re-consents through /me/consents (201), then reaches the dive log again', async () => {
      await as(cookies.a)
        .post('/api/me/consents', { purpose: 'health_data_processing', policyVersion: '2026-11' })
        .expect(201);

      await as(cookies.a).get('/api/dashboard').expect(200);
    });
  });

  describe('A deletes its account', () => {
    it('B is intact, the sessions of A are gone', async () => {
      const before = await stateOfB();

      await as(cookies.a).delete('/api/me', { password: PASSWORD }).expect(204);

      expect(await stateOfB()).toEqual(before);
      expect(await countOf('dive_sites', 'owner_id', ids.diverB)).toBe(1);
      expect(await countOf('dive_events', 'creator_id', ids.diverB)).toBe(1);
      await as(cookies.a).get('/api/me').expect(401);
      await as(cookies.a).get('/api/dashboard').expect(401);
    });
  });
});
