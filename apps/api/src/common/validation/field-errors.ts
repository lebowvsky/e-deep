import type { ApiFieldErrors, ApiValidationErrorResponse } from '@e-deep/shared';
import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/**
 * class-validator constraint name → code of the contract (D-26). Custom constraints are named
 * after their code directly (`length`, `pair`, `duplicate`…) and pass through unchanged.
 */
const BUILT_IN_CODES: Readonly<Record<string, string>> = {
  isDefined: 'required',
  isString: 'type',
  isNumber: 'type',
  isBoolean: 'type',
  isObject: 'type',
  isArray: 'type',
  nestedValidation: 'type',
  isInt: 'integer',
  min: 'min',
  isPositive: 'min',
  max: 'max',
  isIn: 'in',
  isUuid: 'uuid',
  arrayMaxSize: 'too-many',
};

/** class-validator constraint of a property the DTO does not declare (`forbidNonWhitelisted`). */
const WHITELIST_CONSTRAINT = 'whitelistValidation';

/**
 * Fixed key of every unknown property, wherever it is in the body: its name is chosen by the
 * client, so it is never echoed (a name can carry personal data or a probe, D-26).
 */
export const UNKNOWN_PROPERTY_FIELD = '_unknown';

/** `fieldErrors` of a body that is not valid JSON (answered by `LogSafeExceptionFilter`). */
export const MALFORMED_BODY_FIELD_ERRORS: Readonly<ApiFieldErrors> = { _body: ['malformed'] };

/** `fieldErrors` of a route parameter that is not valid percent-encoding. */
export const MALFORMED_PATH_FIELD_ERRORS: Readonly<ApiFieldErrors> = { _path: ['malformed'] };

/**
 * Codes that say everything about a field, by priority: an absent or mistyped value also fails
 * its bounds and its nested rules, which add nothing.
 */
const OVERRIDING_CODES = ['required', 'type'] as const;

/**
 * Flattens nested validation errors into `path → codes` (`participation.maxDepthM`,
 * `observations.3.label`). Only constraint names are read: never the value nor the message, which
 * may quote it (health data).
 *
 * An absent field reports `required` only, a mistyped one `type` only (nor the errors of its
 * content): the other errors they trigger say nothing more. Every unknown property, nested or
 * not, is reported once under `_unknown: ['unknown']`, without its name.
 */
export function toFieldErrors(errors: readonly ValidationError[]): ApiFieldErrors {
  const fieldErrors: ApiFieldErrors = {};
  collect(errors, '', fieldErrors);
  return fieldErrors;
}

function collect(
  errors: readonly ValidationError[],
  parentPath: string,
  fieldErrors: ApiFieldErrors,
): void {
  for (const error of errors) {
    const constraints = Object.keys(error.constraints ?? {});
    if (constraints.includes(WHITELIST_CONSTRAINT)) {
      // An unknown property has no other constraint nor children: nothing else to report.
      fieldErrors[UNKNOWN_PROPERTY_FIELD] = ['unknown'];
      continue;
    }
    const path = parentPath === '' ? error.property : `${parentPath}.${error.property}`;
    const codes = [...new Set(constraints.map(toCode))];
    const overriding = OVERRIDING_CODES.find((code) => codes.includes(code));
    if (overriding !== undefined) {
      fieldErrors[path] = [overriding];
      continue;
    }
    if (codes.length > 0) {
      fieldErrors[path] = codes;
    }
    collect(error.children ?? [], path, fieldErrors);
  }
}

function toCode(constraintName: string): string {
  return BUILT_IN_CODES[constraintName] ?? constraintName;
}

/** The `400` of a request that fails validation (D-26). */
export function validationFailed(fieldErrors: ApiFieldErrors): BadRequestException {
  const body: ApiValidationErrorResponse = {
    statusCode: 400,
    code: 'validation-failed',
    fieldErrors,
  };
  return new BadRequestException(body);
}
