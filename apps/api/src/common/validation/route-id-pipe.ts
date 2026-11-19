import { ParseUUIDPipe } from '@nestjs/common';
import { validationFailed } from './field-errors';

/**
 * A route id that is not a UUID answers the validation `400` of the write contracts (D-26:
 * `{ id: ['uuid'] }`). The `GET` routes keep the default body of `ParseUUIDPipe`, which the front
 * relies on.
 */
export function routeIdPipe(): ParseUUIDPipe {
  return new ParseUUIDPipe({ exceptionFactory: () => validationFailed({ id: ['uuid'] }) });
}
