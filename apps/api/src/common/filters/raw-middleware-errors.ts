import type { INestApplication } from '@nestjs/common';
import { AbstractHttpAdapter } from '@nestjs/core';

/**
 * Hands the client errors raised by Express and its middlewares to `LogSafeExceptionFilter` as
 * they are: body-parser (malformed JSON, payload too large, unsupported charset…) and the router
 * (a route parameter that is not valid percent-encoding). By default the Express adapter maps them
 * to an `HttpException` carrying their message, and those quote the request: the `JSON.parse`
 * message shows a slice of the body, the charset one the charset received, the router one the raw
 * parameter (D-26, GDPR). The filter answers them with a generic body instead.
 *
 * Only 4xx errors are concerned; any other error keeps the adapter's mapping.
 */
export function keepMiddlewareErrorsUnmapped(app: INestApplication): void {
  const adapter: unknown = app.getHttpAdapter();
  if (!(adapter instanceof AbstractHttpAdapter)) {
    throw new Error('Unsupported HTTP adapter');
  }
  const mapException = adapter.mapException.bind(adapter);
  adapter.mapException = (error: unknown): unknown =>
    clientErrorStatus(error) === null ? mapException(error) : error;
}

/**
 * The 4xx status of a client error raised outside Nest: `statusCode` (http-errors, body-parser)
 * or `status` (the Express router's `URIError`); `null` for anything else.
 */
export function clientErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) {
    return null;
  }
  const status: unknown =
    'statusCode' in error ? error.statusCode : 'status' in error ? error.status : undefined;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : null;
}
