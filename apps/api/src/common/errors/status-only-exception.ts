import { STATUS_CODES } from 'node:http';
import { HttpException } from '@nestjs/common';

/**
 * An HTTP error answered with its status and standard reason phrase only
 * (`{ statusCode: 415, message: 'Unsupported Media Type' }`): nothing taken from the request.
 */
export function statusOnlyException(statusCode: number): HttpException {
  return new HttpException(
    { statusCode, message: STATUS_CODES[statusCode] ?? 'Error' },
    statusCode,
  );
}
