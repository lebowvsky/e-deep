import {
  DOMAIN_ERROR_STATUS,
  domainErrorHeaders,
  toDomainErrorResponse,
  toValidationFailedException,
} from './domain-error-http';
import {
  BuddyLinkConflictError,
  ConsentRequiredError,
  DomainValidationError,
  DuplicateObservationError,
  EmailTakenError,
  ForbiddenError,
  FullSyncRequiredError,
  IdentifierConflictError,
  InactiveCertificationLevelError,
  InvalidCredentialsError,
  InvalidReferenceError,
  MergeIntoSelfError,
  OnboardingCompleteError,
  OnboardingRequiredError,
  RegistrationClosedError,
  SiteInUseError,
  TooManyAttemptsError,
  TooManyObservationsError,
  UnauthenticatedError,
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
    [new UnauthenticatedError(), 401],
    [new InvalidCredentialsError(), 401],
    [new TooManyAttemptsError(30), 429],
    [new RegistrationClosedError(), 403],
    [new EmailTakenError(), 409],
    [new OnboardingRequiredError(), 403],
    [new OnboardingCompleteError(), 409],
    [new ConsentRequiredError(), 403],
    [new ForbiddenError(), 403],
  ])('answers %s with %i and its code only (D-26)', (error, statusCode) => {
    expect(toDomainErrorResponse(error)).toStrictEqual({ statusCode, code: error.code });
  });

  it('maps every code', () => {
    expect(Object.keys(DOMAIN_ERROR_STATUS)).toHaveLength(21);
  });

  it('keeps the retry delay out of the body, rounded up to a whole second', () => {
    const error = new TooManyAttemptsError(12.2);

    expect(error.retryAfterSeconds).toBe(13);
    expect(new TooManyAttemptsError(0).retryAfterSeconds).toBe(1);
    expect(toDomainErrorResponse(error)).toStrictEqual({
      statusCode: 429,
      code: 'too-many-attempts',
    });
  });
});

describe('toValidationFailedException', () => {
  it('answers a business validation error like a DTO one, field codes only', () => {
    const exception = toValidationFailedException(
      new DomainValidationError({ password: ['too-short', 'contains-identity'] }),
    );

    expect(exception.getStatus()).toBe(400);
    expect(exception.getResponse()).toStrictEqual({
      statusCode: 400,
      code: 'validation-failed',
      fieldErrors: { password: ['too-short', 'contains-identity'] },
    });
  });
});

describe('domainErrorHeaders', () => {
  it('gives a 429 its Retry-After in whole seconds', () => {
    expect(domainErrorHeaders(new TooManyAttemptsError(12.2))).toStrictEqual({
      'Retry-After': '13',
    });
  });

  it('adds nothing to the other business errors', () => {
    expect(domainErrorHeaders(new InvalidCredentialsError())).toStrictEqual({});
  });
});
