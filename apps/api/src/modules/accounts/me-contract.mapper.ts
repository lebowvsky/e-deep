import type { AdminMeResponse, MeResponse, StaffRole } from '@e-deep/shared';
import { UnsupportedContractValueError } from '../../common/errors/domain-errors';
import {
  CURRENT_HEALTH_POLICY_VERSION,
  isHealthPolicyVersion,
} from '../consents/health-policy-versions';
import type { OnboardingState } from './onboarding.service';

/**
 * `MeResponse` of a diver (§3): the onboarding status is the API's (`onboardingStatusOf`), the
 * front never recomputes it.
 *
 * @throws {UnsupportedContractValueError} for a stored policy version the contract does not know.
 */
export function toMeResponse(
  email: string,
  { diver, consent, status }: OnboardingState,
): MeResponse {
  const level = diver.certificationLevel ?? null;
  return {
    account: { email, role: 'diver' },
    diver: {
      id: diver.id,
      firstName: diver.firstName,
      lastName: diver.lastName,
      level: level === null ? null : { agency: level.agency, code: level.code, label: level.label },
      avatarUrl: diver.avatarUrl,
    },
    consent: consent === null ? null : toConsent(consent.policyVersion, consent.grantedAt),
    currentPolicyVersion: CURRENT_HEALTH_POLICY_VERSION,
    onboarding: status,
  };
}

function toConsent(policyVersion: string, grantedAt: Date): MeResponse['consent'] {
  if (!isHealthPolicyVersion(policyVersion)) {
    throw new UnsupportedContractValueError();
  }
  return { policyVersion, grantedAt: grantedAt.toISOString() };
}

export function toAdminMeResponse(email: string, role: StaffRole): AdminMeResponse {
  return { account: { email, role } };
}
