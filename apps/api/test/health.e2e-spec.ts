import type { HealthResponse } from '@e-deep/shared';
import { Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { configureApp } from '../src/configure-app';
import { HealthModule } from '../src/modules/health/health.module';
import {
  accessControlProviders,
  resetAccessControlFakes,
  sessionFakes,
} from './support/access-control';

// Typed as `unknown`: Jest asymmetric matchers are untyped.
const ISO_TIMESTAMP: unknown = expect.stringMatching(
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
);

/** Expected body: same keys as the shared contract, values may be matchers. */
type HealthResponseMatcher = Record<keyof HealthResponse, unknown>;

const query = jest.fn<Promise<unknown>, [string]>();

/** Stands in for `DatabaseModule`: provides the global `DataSource` without a real connection. */
@Module({
  providers: [{ provide: DataSource, useValue: { query } }],
  exports: [DataSource],
})
class FakeDatabaseModule {}

describe('GET /api/health (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [{ module: FakeDatabaseModule, global: true }, HealthModule],
      // The real global guards: the route is `@Public()`.
      providers: accessControlProviders(),
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, { trustProxy: 0 });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    query.mockReset();
    resetAccessControlFakes();
  });

  it('returns ok when the database is up', async () => {
    query.mockResolvedValue([{ '?column?': 1 }]);

    // Public: no cookie, no session read, cacheable (no `no-store`).
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://localhost:5173')
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      database: 'up',
      timestamp: ISO_TIMESTAMP,
    } satisfies HealthResponseMatcher);
    expect(sessionFakes.resolve).not.toHaveBeenCalled();
    expect(response.headers['cache-control']).toBeUndefined();
    // No CORS any more (D34): same origin only.
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('applies the trust proxy setting', () => {
    // Typed as `unknown`: Express settings are untyped.
    const trustProxy: unknown = app.getHttpAdapter().getInstance().get('trust proxy');

    expect(trustProxy).toBe(0);
  });

  it('returns 200 with a degraded status when the database is down', async () => {
    query.mockRejectedValue(new Error('connection terminated'));

    const response = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(response.body).toEqual({
      status: 'degraded',
      database: 'down',
      timestamp: ISO_TIMESTAMP,
    } satisfies HealthResponseMatcher);
  });

  it('serves routes under the global prefix only', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });
});
