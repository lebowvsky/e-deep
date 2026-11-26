import { testDatabaseEnvironment } from './test-database';

// Imported FIRST by a db test that boots the whole `AppModule`: `ConfigModule.forRoot` reads and
// validates the environment as soon as `app.module.ts` is imported, and the runtime environment
// wins over `.env`. Points it at the `_test` database, with the sign-up open and local
// http cookies. Jest gives each test file its own copy of `process.env`; `restoreEnvironment`
// puts the previous values back anyway.

const OVERRIDES = {
  NODE_ENV: 'test',
  DATABASE_NAME: testDatabaseEnvironment().DATABASE_NAME,
  REGISTRATION_ENABLED: 'true',
  SESSION_COOKIE_SECURE: 'false',
  ALLOWED_ORIGINS: 'http://localhost:5173',
} as const;

const previous = Object.fromEntries(Object.keys(OVERRIDES).map((key) => [key, process.env[key]]));

Object.assign(process.env, OVERRIDES);

export function restoreEnvironment(): void {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}
