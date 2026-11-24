import { Global, Module, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AccessControlModule } from '../src/common/auth/access-control.module';
import { configureApp } from '../src/configure-app';
import { AccountsModule } from '../src/modules/accounts/accounts.module';
import { AdminMeController } from '../src/modules/accounts/admin-me.controller';
import { MeController } from '../src/modules/accounts/me.controller';
import { AdminAuthController } from '../src/modules/auth/admin-auth.controller';
import { AuthHttpModule } from '../src/modules/auth/auth-http.module';
import { AuthController } from '../src/modules/auth/auth.controller';
import { CertificationLevelsController } from '../src/modules/certification-levels/certification-levels.controller';
import { CertificationLevelsModule } from '../src/modules/certification-levels/certification-levels.module';

// The real module graph of the authentication routes (imports, exports, providers, guards), as
// `AppModule` wires it (global guards included), without a database nor `.env`: `AppModule` itself is not imported because
// its `ConfigModule.forRoot` reads `.env`. The config and the `DataSource` are given here.

const SETTINGS: Readonly<Record<string, unknown>> = {
  NODE_ENV: 'test',
  SESSION_COOKIE_SECURE: true,
  REGISTRATION_ENABLED: false,
  DEV_AUTH_STUB: false,
  ALLOWED_ORIGINS: ['http://localhost:5173'],
};

/** What `TypeOrmModule.forFeature` and the services need from a `DataSource`, without a pool. */
const dataSource = {
  options: { type: 'postgres' },
  entityMetadatas: [],
  manager: { find: jest.fn().mockResolvedValue([]) },
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

describe('authentication module graph (e2e, no database)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        FakeInfrastructureModule,
        CertificationLevelsModule,
        AccountsModule,
        AuthHttpModule,
        AccessControlModule,
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, { trustProxy: 0 });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    AuthController,
    AdminAuthController,
    MeController,
    AdminMeController,
    CertificationLevelsController,
  ])('resolves %p with its real providers', (controller) => {
    expect((app as INestApplication).get(controller, { strict: false })).toBeInstanceOf(controller);
  });

  it('serves the routes through the real guards and cookie settings', async () => {
    const me = await request(app.getHttpServer()).get('/api/me').expect(401);
    const logout = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Sec-Fetch-Site', 'same-origin')
      .expect(204);
    const levels = await request(app.getHttpServer()).get('/api/certification-levels').expect(200);

    expect(me.body).toStrictEqual({ statusCode: 401, code: 'unauthenticated' });
    expect(me.headers['cache-control']).toBe('no-store');
    // `SESSION_COOKIE_SECURE=true` reaches `SessionCookies` through the real wiring.
    expect(logout.headers['set-cookie']?.[0]).toMatch(/^__Host-edeep_sid=;.*Secure/);
    expect(levels.body).toStrictEqual({ levels: [] });
  });
});
