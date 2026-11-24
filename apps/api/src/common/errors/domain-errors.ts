import type { ApiDomainErrorCode, ApiFieldErrors } from '@e-deep/shared';

/**
 * Business errors raised by the services. Their messages are generic on purpose (GDPR, no
 * enumeration): they never contain an identifier, a value or a driver message, so they are safe to
 * log. Their code is the one of the API contract (`common/errors/domain-error-http.ts`, D-26).
 */
export type DomainErrorCode = ApiDomainErrorCode;

export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;
}

/** The identifier already exists and belongs to another diver: no takeover through an upsert. */
export class IdentifierConflictError extends DomainError {
  readonly code = 'identifier-conflict';
  constructor() {
    super('Identifier conflict');
    this.name = IdentifierConflictError.name;
  }
}

/** The client's last pull is older than the purge horizon: it must run a full sync first (D-12 d). */
export class FullSyncRequiredError extends DomainError {
  readonly code = 'full-sync-required';
  constructor() {
    super('Full synchronisation required');
    this.name = FullSyncRequiredError.name;
  }
}

/** A site still used by a live dive event cannot be deleted. */
export class SiteInUseError extends DomainError {
  readonly code = 'site-in-use';
  constructor() {
    super('Dive site in use');
    this.name = SiteInUseError.name;
  }
}

/** A diver's current level must be active when chosen (does not apply to participation snapshots). */
export class InactiveCertificationLevelError extends DomainError {
  readonly code = 'inactive-certification-level';
  constructor() {
    super('Inactive certification level');
    this.name = InactiveCertificationLevelError.name;
  }
}

/** A referenced record (site, buddy, level, linked diver) does not exist or is not the caller's. */
export class InvalidReferenceError extends DomainError {
  readonly code = 'invalid-reference';
  constructor() {
    super('Invalid reference');
    this.name = InvalidReferenceError.name;
  }
}

/** The linked account is already linked to another live contact of the same owner. */
export class BuddyLinkConflictError extends DomainError {
  readonly code = 'buddy-link-conflict';
  constructor() {
    super('Buddy link conflict');
    this.name = BuddyLinkConflictError.name;
  }
}

/** A stored value cannot be expressed in the current front contract (e.g. a non-FFESSM level). */
export class UnsupportedContractValueError extends DomainError {
  readonly code = 'unsupported-contract-value';
  constructor() {
    super('Value not supported by the API contract');
    this.name = UnsupportedContractValueError.name;
  }
}

/** Two observations of a dive carry the same label once trimmed (D-19, RG-27). */
export class DuplicateObservationError extends DomainError {
  readonly code = 'duplicate-observation';
  constructor() {
    super('Duplicate observation label');
    this.name = DuplicateObservationError.name;
  }
}

/** A dive carries more observations than the cap (RG-27). */
export class TooManyObservationsError extends DomainError {
  readonly code = 'too-many-observations';
  constructor() {
    super('Too many observations');
    this.name = TooManyObservationsError.name;
  }
}

/** A site cannot be merged into itself (RG-35). */
export class MergeIntoSelfError extends DomainError {
  readonly code = 'merge-into-self';
  constructor() {
    super('Cannot merge a site into itself');
    this.name = MergeIntoSelfError.name;
  }
}

/** No valid session for a route that needs one (D37). */
export class UnauthenticatedError extends DomainError {
  readonly code = 'unauthenticated';
  constructor() {
    super('Authentication required');
    this.name = UnauthenticatedError.name;
  }
}

/**
 * Unknown email, wrong password or an account of the other audience: always the same error, so
 * that the answer never reveals whether an account exists (D35).
 */
export class InvalidCredentialsError extends DomainError {
  readonly code = 'invalid-credentials';
  constructor() {
    super('Invalid credentials');
    this.name = InvalidCredentialsError.name;
  }
}

/** Too many sign-in attempts for the IP or the email (D35); answered with `Retry-After`. */
export class TooManyAttemptsError extends DomainError {
  readonly code = 'too-many-attempts';
  /** Whole seconds to wait before the next attempt can succeed (at least 1). */
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super('Too many attempts');
    this.name = TooManyAttemptsError.name;
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
  }
}

/** Sign-up is closed (`REGISTRATION_ENABLED=false`, closed beta, D39). */
export class RegistrationClosedError extends DomainError {
  readonly code = 'registration-closed';
  constructor() {
    super('Registration closed');
    this.name = RegistrationClosedError.name;
  }
}

/** An account already uses this email (enumeration accepted in the closed beta, D39). */
export class EmailTakenError extends DomainError {
  readonly code = 'email-taken';
  constructor() {
    super('Email already used');
    this.name = EmailTakenError.name;
  }
}

/** The diver has not completed `/welcome` yet (no level, D38). */
export class OnboardingRequiredError extends DomainError {
  readonly code = 'onboarding-required';
  constructor() {
    super('Onboarding required');
    this.name = OnboardingRequiredError.name;
  }
}

/** `/welcome` was already completed: a new consent goes through `/me/consents` (D38). */
export class OnboardingCompleteError extends DomainError {
  readonly code = 'onboarding-complete';
  constructor() {
    super('Onboarding already complete');
    this.name = OnboardingCompleteError.name;
  }
}

/** The diver has no live consent at the current policy version (D38). */
export class ConsentRequiredError extends DomainError {
  readonly code = 'consent-required';
  constructor() {
    super('Consent required');
    this.name = ConsentRequiredError.name;
  }
}

/** The account's role does not allow the action (e.g. a staff account on a diver route, D37). */
export class ForbiddenError extends DomainError {
  readonly code = 'forbidden';
  constructor() {
    super('Forbidden');
    this.name = ForbiddenError.name;
  }
}

/** A body that is not JSON on a state-changing request (D34, `JsonBodyGuard`), or that the parser cannot decode. */
export class UnsupportedMediaTypeError extends DomainError {
  readonly code = 'unsupported-media-type';
  constructor() {
    super('Unsupported media type');
    this.name = UnsupportedMediaTypeError.name;
  }
}

/** A body over the size limit of the parser. */
export class PayloadTooLargeError extends DomainError {
  readonly code = 'payload-too-large';
  constructor() {
    super('Payload too large');
    this.name = PayloadTooLargeError.name;
  }
}

/**
 * A value refused by a business rule that the DTO cannot check (password policy, email that the
 * database could not store, outdated policy version). Answered like a DTO failure:
 * `400 validation-failed` with `fieldErrors` (`common/validation/field-errors.ts`, D-26). Not a
 * `DomainError`: its code is the validation one, not a business one.
 */
export class DomainValidationError extends Error {
  /** Request path → codes; never the value received. */
  readonly fieldErrors: ApiFieldErrors;
  constructor(fieldErrors: ApiFieldErrors) {
    super('Validation failed');
    this.name = DomainValidationError.name;
    this.fieldErrors = fieldErrors;
  }
}
