import { ConsoleLogger } from '@nestjs/common';
import { errorClassName } from './error-class-name';

/** Environments where stacks are printed: a developer's machine and the test runs. */
const STACK_ENVIRONMENTS: ReadonlySet<string> = new Set(['development', 'test']);

/** A V8 stack trace: a first line, then at least one `    at …` frame. */
const STACK_TRACE = /\n\s+at /;

/**
 * Application logger (`NestFactory.create(…, { logger })`), boot included. Outside development
 * and test, `error` and `fatal` never print a stack: a stack repeats the error message, and the
 * message of a library error can carry connection details or data (§9.10: `@nestjs/typeorm`
 * logs `error.stack` on each failed connection attempt, which names the database host and port).
 * An `Error` given as the message or as a parameter is replaced by its class name
 * (`errorClassName`); a string that is a stack trace is dropped. The message and the context are
 * kept.
 *
 * The environment is `process.env.NODE_ENV`, read before the configuration is validated, so any
 * value other than `development` or `test` (none included) counts as production: fail-safe.
 */
export class LogSafeLogger extends ConsoleLogger {
  private readonly keepsStacks: boolean;

  /** @param environment - \`process.env.NODE_ENV\`, read before the configuration is validated. */
  constructor(environment: string | undefined) {
    super();
    this.keepsStacks = environment !== undefined && STACK_ENVIRONMENTS.has(environment);
  }

  override error(message: unknown, ...optionalParams: unknown[]): void {
    if (this.keepsStacks) {
      super.error(message, ...optionalParams);
      return;
    }
    super.error(withoutError(message), ...withoutStacks(optionalParams));
  }

  override fatal(message: unknown, ...optionalParams: unknown[]): void {
    if (this.keepsStacks) {
      super.fatal(message, ...optionalParams);
      return;
    }
    super.fatal(withoutError(message), ...withoutStacks(optionalParams));
  }
}

function withoutError(value: unknown): unknown {
  return value instanceof Error ? errorClassName(value) : value;
}

function withoutStacks(params: readonly unknown[]): unknown[] {
  return params
    .filter((param) => !(typeof param === 'string' && STACK_TRACE.test(param)))
    .map(withoutError);
}
