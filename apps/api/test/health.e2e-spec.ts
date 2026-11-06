import type { HealthResponse } from '@e-deep/shared';
import { Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
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
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [{ module: FakeDatabaseModule, global: true }, HealthModule],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, { corsOrigins: [WEB_ORIGIN] });
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
