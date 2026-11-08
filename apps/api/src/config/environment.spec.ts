import 'reflect-metadata';
import { EnvironmentVariables, validateEnvironment } from './environment';

const BASE = {
  DATABASE_HOST: '127.0.0.1',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'edeep',
  DATABASE_PASSWORD: 'secret',
  DATABASE_NAME: 'edeep',
  CORS_ORIGINS: 'http://localhost:5173',
};

describe('EnvironmentVariables.DEV_AUTH_STUB', () => {
  it('is disabled by default', () => {
    expect(validateEnvironment(EnvironmentVariables, BASE).DEV_AUTH_STUB).toBe(false);
  });

  it('is only enabled by the exact value "true"', () => {
    expect(
      validateEnvironment(EnvironmentVariables, { ...BASE, DEV_AUTH_STUB: 'true' }).DEV_AUTH_STUB,
    ).toBe(true);
    for (const value of ['false', '1', 'yes', '']) {
      expect(
        validateEnvironment(EnvironmentVariables, { ...BASE, DEV_AUTH_STUB: value }).DEV_AUTH_STUB,
      ).toBe(false);
    }
  });
});
