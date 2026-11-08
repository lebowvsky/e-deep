/**
 * Business errors raised by the services. Their messages are generic on purpose (GDPR, no
 * enumeration): they never contain an identifier, a value or a driver message, so they are safe to
 * log and to map to an HTTP response once the endpoints exist.
 */
export type DomainErrorCode =
  | 'identifier-conflict'
  | 'full-sync-required'
  | 'site-in-use'
  | 'inactive-certification-level'
  | 'invalid-reference'
  | 'buddy-link-conflict'
  | 'unsupported-contract-value';

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
