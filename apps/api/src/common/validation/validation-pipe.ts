import { ValidationPipe } from '@nestjs/common';
import { toFieldErrors, validationFailed } from './field-errors';

/**
 * Global validation of bodies and parameters: unknown properties are refused (`_unknown: ['unknown']`,
 * never their name), payloads
 * are turned into their DTO class, and a failure answers `400 validation-failed` with field errors.
 * The errors keep neither the target nor the value (GDPR).
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors) => validationFailed(toFieldErrors(errors)),
  });
}
