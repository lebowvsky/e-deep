import { DOMAIN_ERROR_STATUS, toDomainErrorResponse } from './domain-error-http';
import {
  BuddyLinkConflictError,
  DuplicateObservationError,
  FullSyncRequiredError,
  IdentifierConflictError,
  InactiveCertificationLevelError,
  InvalidReferenceError,
  MergeIntoSelfError,
  SiteInUseError,
  TooManyObservationsError,
  UnsupportedContractValueError,
  type DomainError,
} from './domain-errors';

describe('toDomainErrorResponse', () => {
  it.each<[DomainError, number]>([
    [new DuplicateObservationError(), 400],
    [new TooManyObservationsError(), 400],
    [new IdentifierConflictError(), 409],
    [new BuddyLinkConflictError(), 409],
    [new SiteInUseError(), 409],
    [new FullSyncRequiredError(), 409],
    [new InvalidReferenceError(), 422],
    [new InactiveCertificationLevelError(), 422],
    [new MergeIntoSelfError(), 422],
    [new UnsupportedContractValueError(), 500],
  ])('answers %s with %i and its code only (D-26)', (error, statusCode) => {
    expect(toDomainErrorResponse(error)).toEqual({ statusCode, code: error.code });
  });

  it('maps every code', () => {
    expect(Object.keys(DOMAIN_ERROR_STATUS)).toHaveLength(10);
  });
});
