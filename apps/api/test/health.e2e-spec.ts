import type { HealthResponse } from '@e-deep/shared';
import { Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { configureApp } from '../src/configure-app';
import { HealthModule } from '../src/modules/health/health.module';

const WEB_ORIGIN = 'http://localhost:5173';

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
    }).compile();

    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, { corsOrigins: [WEB_ORIGIN], trustProxy: 0 });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    query.mockReset();
  });

  it('returns ok when the database is up', async () => {
    query.mockResolvedValue([{ '?column?': 1 }]);

    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', WEB_ORIGIN)
      .expect(200);

    expect(response.body).toEqual({
      status: 'ok',
      database: 'up',
      timestamp: ISO_TIMESTAMP,
    } satisfies HealthResponseMatcher);
    expect(response.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
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
