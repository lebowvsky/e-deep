import {
  Catch,
  HttpException,
  InternalServerErrorException,
  Logger,
  type ArgumentsHost,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { errorClassName } from '../logging/error-class-name';

/**
 * Replaces Nest's default handling of unexpected errors, which logs the full message and stack
 * (e.g. a `QueryFailedError` carries the SQL query and its parameters).
 * `HttpException`s keep Nest's default behavior: they are replied as-is and not logged.
 */
@Catch()
export class LogSafeExceptionFilter extends BaseExceptionFilter<unknown> {
  private readonly logger = new Logger(LogSafeExceptionFilter.name);

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException) {
      super.catch(exception, host);
      return;
    }

    // Errors raised by middlewares such as body-parser (malformed JSON, payload too large) are client errors.
    if (this.isHttpError(exception)) {
      super.catch(
        new HttpException(this.getHttpErrorMessage(exception), exception.statusCode),
        host,
      );
      return;
    }

    // GDPR: log the error class only, never its message or stack (see errorClassName).
    this.logger.error(`Unhandled ${errorClassName(exception)}`);
    super.catch(new InternalServerErrorException(), host);
  }
}
