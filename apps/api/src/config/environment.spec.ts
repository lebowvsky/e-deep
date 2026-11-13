import 'reflect-metadata';
import {
  EnvironmentValidationError,
  EnvironmentVariables,
  validateEnvironment,
} from './environment';

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

describe('EnvironmentVariables.NODE_ENV', () => {
  it('defaults to development', () => {
    expect(validateEnvironment(EnvironmentVariables, BASE).NODE_ENV).toBe('development');
  });

  it('accepts development, test and production', () => {
    for (const value of ['development', 'test', 'production']) {
      expect(validateEnvironment(EnvironmentVariables, { ...BASE, NODE_ENV: value }).NODE_ENV).toBe(
        value,
      );
    }
  });

  it('rejects any other value without echoing it', () => {
    const validate = () =>
      validateEnvironment(EnvironmentVariables, { ...BASE, NODE_ENV: 'staging-secret' });

    expect(validate).toThrow(EnvironmentValidationError);
    expect(validate).toThrow(/NODE_ENV/);
    expect(validate).not.toThrow(/staging-secret/);
  });
});

describe('EnvironmentVariables.DEV_AUTH_STUB in production', () => {
  it('is refused, naming the variables but none of their values', () => {
    let error: unknown;
    try {
      validateEnvironment(EnvironmentVariables, {
        ...BASE,
        NODE_ENV: 'production',
        DEV_AUTH_STUB: 'true',
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(EnvironmentValidationError);
    const { message } = error as EnvironmentValidationError;
    expect(message).toContain('DEV_AUTH_STUB');
    expect(message).toContain('devAuthStubForbiddenInProduction');
    for (const value of Object.values(BASE)) {
      expect(message).not.toContain(value);
    }
    expect(message).not.toMatch(/\b(true|production)\b/);
  });

  it('is allowed in development and test', () => {
    for (const NODE_ENV of ['development', 'test']) {
      expect(
        validateEnvironment(EnvironmentVariables, { ...BASE, NODE_ENV, DEV_AUTH_STUB: 'true' })
          .DEV_AUTH_STUB,
      ).toBe(true);
    }
  });

  it('accepts production when the stub is disabled', () => {
    const environment = validateEnvironment(EnvironmentVariables, {
      ...BASE,
      NODE_ENV: 'production',
    });
    expect(environment.NODE_ENV).toBe('production');
    expect(environment.DEV_AUTH_STUB).toBe(false);
  });
});
