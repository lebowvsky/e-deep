import {
  Catch,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  type ArgumentsHost,
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import type { Request, Response } from 'express';
import {
  domainErrorHeaders,
  toDomainErrorResponse,
  toValidationFailedException,
} from '../errors/domain-error-http';
import {
  DomainError,
  DomainValidationError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
} from '../errors/domain-errors';
import { statusOnlyException } from '../errors/status-only-exception';
import { errorClassName } from '../logging/error-class-name';
import {
  MALFORMED_BODY_FIELD_ERRORS,
  MALFORMED_PATH_FIELD_ERRORS,
  validationFailed,
} from '../validation/field-errors';
import { clientErrorStatus } from './raw-middleware-errors';

/**
 * Replaces Nest's default handling of unexpected errors, which logs the full message and stack
 * (e.g. a `QueryFailedError` carries the SQL query and its parameters).
 * `HttpException`s keep Nest's default behavior: they are replied as-is and not logged.
 * A `DomainError` is replied `{ statusCode, code }` with its status (D-26) and its headers
 * (`Retry-After` on a 429); only a 5xx is logged.
 * A `DomainValidationError` is replied like a DTO failure (`400 validation-failed`), not logged.
 * A client error of Express or a middleware (body-parser, router), or the 404 of an unknown route,
 * gets a generic body: their messages quote the request.
 *
 * Every error answer is `Cache-Control: no-store` (D37): an error raised before the guards (body
 * parsing, unknown route) never went through the `SessionGuard`, which marks the others.
 */
@Catch()
export class LogSafeExceptionFilter extends BaseExceptionFilter<unknown> {
  private readonly logger = new Logger(LogSafeExceptionFilter.name);

  override catch(exception: unknown, host: ArgumentsHost): void {
    this.setHeaders(host, { 'Cache-Control': 'no-store' });

    if (exception instanceof HttpException) {
      // Nest's answer to an unknown route quotes its URL (`Cannot GET /api/…`).
      super.catch(isUnmatchedRoute(exception, host) ? statusOnlyException(404) : exception, host);
      return;
    }

    if (exception instanceof DomainError) {
      const response = toDomainErrorResponse(exception);
      if (response.statusCode >= 500) {
        this.logger.error(`Unhandled ${errorClassName(exception)}`);
      }
      this.setHeaders(host, domainErrorHeaders(exception));
      super.catch(new HttpException(response, response.statusCode), host);
      return;
    }

    if (exception instanceof DomainValidationError) {
      super.catch(toValidationFailedException(exception), host);
      return;
    }

    // Client errors of Express and its middlewares (body-parser, router): a generic answer.
    const clientStatus = clientErrorStatus(exception);
    if (clientStatus !== null) {
      this.catchClientError(exception, clientStatus, host);
      return;
    }

    if (this.isHttpError(exception)) {
      this.logger.error(`Unhandled ${errorClassName(exception)}`);
      super.catch(statusOnlyException(exception.statusCode), host);
      return;
    }

    // GDPR: log the error class only, never its message or stack (see errorClassName).
    this.logger.error(`Unhandled ${errorClassName(exception)}`);
    super.catch(new InternalServerErrorException(), host);
  }

  /**
   * Without the error's message, which may quote the request. A route parameter that is not
   * valid percent-encoding is `_path: ['malformed']`, a body that cannot be read
   * `_body: ['malformed']`; a body too large or of an unsupported type gets its contract code;
   * any other status its standard reason phrase only.
   */
  private catchClientError(exception: unknown, status: number, host: ArgumentsHost): void {
    if (status === BAD_REQUEST) {
      const fieldErrors =
        exception instanceof URIError ? MALFORMED_PATH_FIELD_ERRORS : MALFORMED_BODY_FIELD_ERRORS;
      super.catch(validationFailed(fieldErrors), host);
      return;
    }
    if (status === PAYLOAD_TOO_LARGE) {
      this.catch(new PayloadTooLargeError(), host);
      return;
    }
    if (status === UNSUPPORTED_MEDIA_TYPE) {
      this.catch(new UnsupportedMediaTypeError(), host);
      return;
    }
    super.catch(statusOnlyException(status), host);
  }

  private setHeaders(host: ArgumentsHost, headers: Readonly<Record<string, string>>): void {
    if (host.getType() !== 'http') {
      return;
    }
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent) {
      return;
    }
    for (const [name, value] of Object.entries(headers)) {
      response.setHeader(name, value);
    }
  }
}

const BAD_REQUEST: number = HttpStatus.BAD_REQUEST;
const PAYLOAD_TOO_LARGE: number = HttpStatus.PAYLOAD_TOO_LARGE;
const UNSUPPORTED_MEDIA_TYPE: number = HttpStatus.UNSUPPORTED_MEDIA_TYPE;

/**
 * The 404 of Nest's catch-all for an unknown route, recognised by its exact message
 * (`Cannot GET /api/…`, built from the method and the original URL): a handler's own 404 never
 * has it, and keeps its body.
 */
function isUnmatchedRoute(exception: HttpException, host: ArgumentsHost): boolean {
  if (exception.getStatus() !== Number(HttpStatus.NOT_FOUND) || host.getType() !== 'http') {
    return false;
  }
  const { method, originalUrl } = host.switchToHttp().getRequest<Request>();
  return exception.message === `Cannot ${method} ${originalUrl}`;
}
