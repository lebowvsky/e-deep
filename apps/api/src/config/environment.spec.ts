import 'reflect-metadata';
import {
  EnvironmentValidationError,
  EnvironmentVariables,
  validateEnvironment,
} from './environment';

const BASE = {
  NODE_ENV: 'development',
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

describe('EnvironmentVariables.REGISTRATION_ENABLED', () => {
  it('is disabled by default (closed beta, D39)', () => {
    expect(validateEnvironment(EnvironmentVariables, BASE).REGISTRATION_ENABLED).toBe(false);
  });

  it('is only enabled by the exact value "true"', () => {
    expect(
      validateEnvironment(EnvironmentVariables, { ...BASE, REGISTRATION_ENABLED: 'true' })
        .REGISTRATION_ENABLED,
    ).toBe(true);
    for (const value of ['false', 'TRUE', '1', 'yes', '']) {
      expect(
        validateEnvironment(EnvironmentVariables, { ...BASE, REGISTRATION_ENABLED: value })
          .REGISTRATION_ENABLED,
      ).toBe(false);
    }
  });
});

describe('EnvironmentVariables.NODE_ENV', () => {
  it('is required, naming the variable but none of the values', () => {
    const { NODE_ENV: _omitted, ...withoutNodeEnv } = BASE;

    const message = validationMessage(withoutNodeEnv);

    expect(message.split('\n')).toContain('  - NODE_ENV: isIn');
    for (const value of Object.values(withoutNodeEnv)) {
      expect(message).not.toContain(value);
    }
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

describe('EnvironmentVariables.TRUST_PROXY', () => {
  it('defaults to 0', () => {
    expect(validateEnvironment(EnvironmentVariables, BASE).TRUST_PROXY).toBe(0);
  });

  it('accepts a number of hops', () => {
    expect(
      validateEnvironment(EnvironmentVariables, { ...BASE, TRUST_PROXY: '2' }).TRUST_PROXY,
    ).toBe(2);
  });

  it.each(['-1', '1.5', 'abc'])('rejects %p without echoing it', (value) => {
    const message = validationMessage({ ...BASE, TRUST_PROXY: value });

    expect(message).toContain('TRUST_PROXY');
    expect(message).not.toContain(value);
  });
});

describe('EnvironmentVariables.SESSION_COOKIE_SECURE', () => {
  it('is enabled by default', () => {
    expect(validateEnvironment(EnvironmentVariables, BASE).SESSION_COOKIE_SECURE).toBe(true);
  });

  it('is only disabled by the exact value "false"', () => {
    expect(
      validateEnvironment(EnvironmentVariables, { ...BASE, SESSION_COOKIE_SECURE: 'false' })
        .SESSION_COOKIE_SECURE,
    ).toBe(false);
    for (const value of ['true', '0', 'no', '']) {
      expect(
        validateEnvironment(EnvironmentVariables, { ...BASE, SESSION_COOKIE_SECURE: value })
          .SESSION_COOKIE_SECURE,
      ).toBe(true);
    }
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

/** Validates `rawEnvironment`, expecting it to be refused, and returns the error message. */
function validationMessage(rawEnvironment: Record<string, unknown>): string {
  try {
    validateEnvironment(EnvironmentVariables, rawEnvironment);
  } catch (error) {
    expect(error).toBeInstanceOf(EnvironmentValidationError);
    return (error as EnvironmentValidationError).message;
  }
  throw new Error('Expected the environment to be refused');
}
