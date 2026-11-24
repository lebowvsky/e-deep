import type { ApiDomainErrorResponse } from '@e-deep/shared';
import { HttpStatus, type BadRequestException } from '@nestjs/common';
import { validationFailed } from '../validation/field-errors';
import {
  TooManyAttemptsError,
  type DomainError,
  type DomainErrorCode,
  type DomainValidationError,
} from './domain-errors';

/**
 * HTTP status of every business error (D-26). Exhaustive by type: a new code does not compile
 * until it is mapped here.
 */
export const DOMAIN_ERROR_STATUS = {
  'duplicate-observation': HttpStatus.BAD_REQUEST,
  'too-many-observations': HttpStatus.BAD_REQUEST,
  'identifier-conflict': HttpStatus.CONFLICT,
  'buddy-link-conflict': HttpStatus.CONFLICT,
  'site-in-use': HttpStatus.CONFLICT,
  'full-sync-required': HttpStatus.CONFLICT,
  'invalid-reference': HttpStatus.UNPROCESSABLE_ENTITY,
  'inactive-certification-level': HttpStatus.UNPROCESSABLE_ENTITY,
  'merge-into-self': HttpStatus.UNPROCESSABLE_ENTITY,
  unauthenticated: HttpStatus.UNAUTHORIZED,
  'invalid-credentials': HttpStatus.UNAUTHORIZED,
  'registration-closed': HttpStatus.FORBIDDEN,
  'onboarding-required': HttpStatus.FORBIDDEN,
  'consent-required': HttpStatus.FORBIDDEN,
  forbidden: HttpStatus.FORBIDDEN,
  'email-taken': HttpStatus.CONFLICT,
  'onboarding-complete': HttpStatus.CONFLICT,
  // With a `Retry-After` header (`domainErrorHeaders`).
  'too-many-attempts': HttpStatus.TOO_MANY_REQUESTS,
  // The server failed to map one of its own values: a bug, not a client error.
  'unsupported-contract-value': HttpStatus.INTERNAL_SERVER_ERROR,
} as const satisfies Record<DomainErrorCode, HttpStatus>;

/** Body of a business error: its status and code, nothing else (no identifier, no value). */
export function toDomainErrorResponse(error: DomainError): ApiDomainErrorResponse {
  return { statusCode: DOMAIN_ERROR_STATUS[error.code], code: error.code };
}

/**
 * Headers that go with a business error: `Retry-After` (whole seconds) on a `429
 * too-many-attempts` (D35), so that the client can wait instead of retrying blindly.
 */
export function domainErrorHeaders(error: DomainError): Readonly<Record<string, string>> {
  if (error instanceof TooManyAttemptsError) {
    return { 'Retry-After': String(error.retryAfterSeconds) };
  }
  return {};
}

/**
 * A business validation failure is answered exactly like a DTO one (`400 validation-failed` with
 * `fieldErrors`), through the same builder as the global `ValidationPipe`.
 */
export function toValidationFailedException(error: DomainValidationError): BadRequestException {
  return validationFailed(error.fieldErrors);
}
