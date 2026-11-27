import 'reflect-metadata';
import { randomBytes } from 'node:crypto';
import {
  EnvironmentValidationError,
  EnvironmentVariables,
  TotpEnrolmentEnvironment,
  validateEnvironment,
} from './environment';

const BASE = {
  NODE_ENV: 'development',
  DATABASE_HOST: '127.0.0.1',
  DATABASE_PORT: '5432',
  DATABASE_USER: 'edeep',
  DATABASE_PASSWORD: 'secret',
  DATABASE_NAME: 'edeep',
  ALLOWED_ORIGINS: 'http://localhost:5173',
};

describe('validateEnvironment', () => {
  it('ignores a variable the schema does not declare (no whitelist: leftover lines do not block)', () => {
    expect(() =>
      validateEnvironment(EnvironmentVariables, {
        ...BASE,
        NODE_ENV: 'production',
        LEFTOVER_VARIABLE: 'true',
      }),
    ).not.toThrow();
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

describe('EnvironmentVariables.ALLOWED_ORIGINS', () => {
  it('splits a comma-separated list of bare origins', () => {
    expect(
      validateEnvironment(EnvironmentVariables, {
        ...BASE,
        ALLOWED_ORIGINS: 'http://localhost:5173, https://app.example.test',
      }).ALLOWED_ORIGINS,
    ).toEqual(['http://localhost:5173', 'https://app.example.test']);
  });

  it('is required: CORS_ORIGINS no longer stands for it (no CORS, D34)', () => {
    const { ALLOWED_ORIGINS: _omitted, ...withoutOrigins } = BASE;

    const message = validationMessage({ ...withoutOrigins, CORS_ORIGINS: 'http://localhost:5173' });

    expect(message).toContain('ALLOWED_ORIGINS');
  });

  it.each(['http://localhost:5173/', 'http://localhost:5173/path', 'localhost:5173'])(
    'rejects %p, which a browser never sends as an Origin, without echoing it',
    (value) => {
      const message = validationMessage({ ...BASE, ALLOWED_ORIGINS: value });

      expect(message).toContain('ALLOWED_ORIGINS');
      expect(message).not.toContain(value);
    },
  );
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

describe('TOTP_ENCRYPTION_KEY', () => {
  const key = randomBytes(32).toString('base64');

  it('is optional for the API (a fresh install has no staff account)', () => {
    expect(validateEnvironment(EnvironmentVariables, BASE).TOTP_ENCRYPTION_KEY).toBeUndefined();
  });

  it('accepts the base64 of 32 bytes', () => {
    expect(
      validateEnvironment(EnvironmentVariables, { ...BASE, TOTP_ENCRYPTION_KEY: key })
        .TOTP_ENCRYPTION_KEY,
    ).toBe(key);
  });

  it.each([
    ['16 bytes', randomBytes(16).toString('base64')],
    ['64 bytes', randomBytes(64).toString('base64')],
    ['hex', randomBytes(32).toString('hex')],
    ['base64url', Buffer.alloc(32, 0xfb).toString('base64url')],
    ['empty', ''],
  ])('refuses %s, naming the variable but never the value', (_case, value) => {
    for (const schema of [EnvironmentVariables, TotpEnrolmentEnvironment]) {
      const message = validationMessage({ ...BASE, TOTP_ENCRYPTION_KEY: value }, schema);

      expect(message.split('\n')).toContain('  - TOTP_ENCRYPTION_KEY: isTotpEncryptionKey');
      if (value !== '') {
        expect(message).not.toContain(value);
      }
    }
  });

  it('is required by the commands that enrol a staff second factor', () => {
    const message = validationMessage(BASE, TotpEnrolmentEnvironment);

    expect(message.split('\n')).toContain('  - TOTP_ENCRYPTION_KEY: isTotpEncryptionKey');
    expect(
      validateEnvironment(TotpEnrolmentEnvironment, { ...BASE, TOTP_ENCRYPTION_KEY: key })
        .TOTP_ENCRYPTION_KEY,
    ).toBe(key);
  });
});

/** Validates `rawEnvironment`, expecting it to be refused, and returns the error message. */
function validationMessage(
  rawEnvironment: Record<string, unknown>,
  schema: typeof EnvironmentVariables | typeof TotpEnrolmentEnvironment = EnvironmentVariables,
): string {
  try {
    validateEnvironment<object>(schema, rawEnvironment);
  } catch (error) {
    expect(error).toBeInstanceOf(EnvironmentValidationError);
    return (error as EnvironmentValidationError).message;
  }
  throw new Error('Expected the environment to be refused');
}
