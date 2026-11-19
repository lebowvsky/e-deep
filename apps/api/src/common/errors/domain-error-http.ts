import type { ApiDomainErrorResponse } from '@e-deep/shared';
import { HttpStatus } from '@nestjs/common';
import type { DomainError, DomainErrorCode } from './domain-errors';

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
  // The server failed to map one of its own values: a bug, not a client error.
  'unsupported-contract-value': HttpStatus.INTERNAL_SERVER_ERROR,
} as const satisfies Record<DomainErrorCode, HttpStatus>;

/** Body of a business error: its status and code, nothing else (no identifier, no value). */
export function toDomainErrorResponse(error: DomainError): ApiDomainErrorResponse {
  return { statusCode: DOMAIN_ERROR_STATUS[error.code], code: error.code };
}
