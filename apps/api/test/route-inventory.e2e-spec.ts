import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { APPLICATION_MODULES } from '../src/application-modules';
import { configureApp } from '../src/configure-app';
import {
  SUPERTEST_METHODS,
  concretePath,
  hasErrorCode,
  inventoryRoutes,
  type InventoriedRoute,
} from './support/route-inventory';

// Refusal by default (D37): the frozen list of the public routes, then a cookie-less call on every
// other route of the application. Mounts exactly the modules of `AppModule` (`APPLICATION_MODULES`,
// global guards included) on a fake infrastructure: no database, no `.env`. `DEV_AUTH_STUB` is off.

/**
 * The only routes reachable without a session (§3 of docs/plans/auth.md). Adding a public route
 * means adding it here, on purpose.
 */
const PUBLIC_ROUTES = [
  'GET /api/certification-levels',
  'GET /api/health',
  'POST /api/admin/auth/login',
  'POST /api/admin/auth/logout',
  'POST /api/auth/login',
  'POST /api/auth/logout',
  'POST /api/auth/register',
];

const SETTINGS: Readonly<Record<string, unknown>> = {
  NODE_ENV: 'test',
  SESSION_COOKIE_SECURE: true,
  REGISTRATION_ENABLED: false,
  DEV_AUTH_STUB: false,
  ALLOWED_ORIGINS: ['http://localhost:5173'],
  SYNC_PURGE_HORIZON_DAYS: 90,
};

/** Fails any query: a refused request must never reach the database. */
const unreachable = jest.fn(() => {
  throw new Error('The database must not be reached');
});

/** What `TypeOrmModule.forFeature` needs from a `DataSource` at boot, without a pool. */
const dataSource = {
  options: { type: 'postgres' },
  entityMetadatas: [],
  manager: { find: unreachable, findOne: unreachable, query: unreachable },
  query: unreachable,
  transaction: unreachable,
  getRepository: () => ({}),
};

@Global()
@Module({
  providers: [
    { provide: ConfigService, useValue: { get: (key: string): unknown => SETTINGS[key] } },
    { provide: DataSource, useValue: dataSource },
  ],
  exports: [ConfigService, DataSource],
})
class FakeInfrastructureModule {}

describe('route inventory (e2e, no database)', () => {
  let app: NestExpressApplication;
  let routes: InventoriedRoute[];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeInfrastructureModule, DiscoveryModule, ...APPLICATION_MODULES],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, { trustProxy: 0 });
    await app.init();
    routes = inventoryRoutes(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('finds the routes of every module', () => {
    expect(routes.length).toBeGreaterThan(PUBLIC_ROUTES.length);
    expect(routes.map((route) => route.key)).toEqual(
      expect.arrayContaining(['GET /api/dashboard', 'GET /api/me', 'GET /api/admin/me']),
    );
  });

  it('declares exactly the frozen list of public routes', () => {
    expect(routes.filter((route) => route.isPublic).map((route) => route.key)).toEqual(
      PUBLIC_ROUTES,
    );
  });

  describe('every other route', () => {
    it('is not empty', () => {
      expect(routes.filter((route) => !route.isPublic).length).toBeGreaterThan(0);
    });

    it('401 unauthenticated without a cookie, no-store, database untouched', async () => {
      const refusals: string[] = [];
      for (const route of routes.filter(({ isPublic }) => !isPublic)) {
        const agent = request(app.getHttpServer());
        const response = await agent[SUPERTEST_METHODS[route.method]](concretePath(route.path))
          // A same-origin browser request: the `OriginGuard` lets it through to the session check.
          .set('Sec-Fetch-Site', 'same-origin')
          .send({});
        const passed =
          response.status === 401 &&
          hasErrorCode(response.body, 'unauthenticated') &&
          response.headers['cache-control'] === 'no-store';
        if (!passed) {
          refusals.push(`${route.key} → ${String(response.status)}`);
        }
      }

      expect(refusals).toEqual([]);
      expect(unreachable).not.toHaveBeenCalled();
    });
  });
});
