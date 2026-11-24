import { SetMetadata } from '@nestjs/common';

export const ALLOW_INCOMPLETE_PROFILE_KEY = 'auth:allowIncompleteProfile';

/**
 * Lets a web route through before `/welcome` and without a consent at the current policy version
 * (D37, D38): the account routes (`/me…`, `logout-all`). Every other web route (the dive log)
 * answers `403 onboarding-required` or `403 consent-required` until the profile is complete.
 */
export const AllowIncompleteProfile = (): ClassDecorator & MethodDecorator =>
  SetMetadata(ALLOW_INCOMPLETE_PROFILE_KEY, true);
