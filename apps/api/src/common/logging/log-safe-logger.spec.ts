import { LogSafeLogger } from './log-safe-logger';

/** Connection details carried by the stack of a TypeORM connection failure. */
const SENSITIVE_DETAIL = 'connect ECONNREFUSED 10.0.0.12:5432';

class FakeConnectionError extends Error {}

function connectionError(): FakeConnectionError {
  return new FakeConnectionError(SENSITIVE_DETAIL);
}

describe('LogSafeLogger', () => {
  let written: string[];

  beforeEach(() => {
    written = [];
    const capture = (chunk: string | Uint8Array): boolean => {
      written.push(String(chunk));
      return true;
    };
    jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    jest.spyOn(process.stderr, 'write').mockImplementation(capture);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function output(): string {
    return written.join('');
  }

  describe('in production', () => {
    const logger = new LogSafeLogger('production');

    it('drops the stack of a @nestjs/typeorm connection failure, keeping message and context', () => {
      // The exact call of @nestjs/typeorm: `new Logger('TypeOrmModule').error(message, error.stack)`.
      logger.error(
        'Unable to connect to the database. Retrying (1)...',
        connectionError().stack,
        'TypeOrmModule',
      );

      expect(output()).toContain('Unable to connect to the database. Retrying (1)...');
      expect(output()).toContain('[TypeOrmModule]');
      expect(output()).not.toContain(SENSITIVE_DETAIL);
    });

    it('logs only the class name of an Error given as the message (Nest ExceptionHandler)', () => {
      logger.error(connectionError());

      expect(output()).toContain('FakeConnectionError');
      expect(output()).not.toContain(SENSITIVE_DETAIL);
    });

    it('logs only the class name of an Error given as a parameter', () => {
      logger.fatal('Bootstrap failed', connectionError(), 'Bootstrap');

      expect(output()).toContain('Bootstrap failed');
      expect(output()).toContain('FakeConnectionError');
      expect(output()).not.toContain(SENSITIVE_DETAIL);
    });

    it('keeps an ordinary error message and its context', () => {
      logger.error('Unhandled QueryFailedError', 'LogSafeExceptionFilter');

      expect(output()).toContain('Unhandled QueryFailedError');
      expect(output()).toContain('[LogSafeExceptionFilter]');
    });
  });

  it('treats an unknown or missing NODE_ENV as production (fail-safe)', () => {
    new LogSafeLogger(undefined).error('Failure', connectionError().stack, 'Ctx');

    expect(output()).not.toContain(SENSITIVE_DETAIL);
  });

  it.each(['development', 'test'])('keeps the stack in %s', (environment) => {
    new LogSafeLogger(environment).error('Failure', connectionError().stack, 'Ctx');

    expect(output()).toContain(SENSITIVE_DETAIL);
  });
});
