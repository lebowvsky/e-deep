import { DomainValidationError } from '../../common/errors/domain-errors';
import type { HealthPolicyVersion } from '@e-deep/shared';

/**
 * Every version of the health data policy (D38), the shared `HealthPolicyVersion` union as a
 * runtime list. Stored as `text` in `consents.policy_version`, so older versions stay readable.
 *
 * Rule: a literal is never removed from the union nor from this list, even once outdated: the
 * consents granted to it stay in the history. A new version is added to the union first (front
 * deployed first), then here, then becomes `CURRENT_HEALTH_POLICY_VERSION`.
 */
export const HEALTH_POLICY_VERSIONS = ['2026-11'] as const satisfies readonly HealthPolicyVersion[];

/** The only version a diver can consent to; an older live consent means `consent-required`. */
export const CURRENT_HEALTH_POLICY_VERSION: HealthPolicyVersion = '2026-11';

/** Narrows a stored `policy_version` to a known version, without any cast. */
export function isHealthPolicyVersion(value: string): value is HealthPolicyVersion {
  return HEALTH_POLICY_VERSIONS.some((version) => version === value);
}

/**
 * Only the current version can be consented to.
 *
 * @throws {DomainValidationError} `fieldErrors.policyVersion: ['outdated']`.
 */
export function assertCurrentHealthPolicyVersion(policyVersion: string): void {
  if (policyVersion !== CURRENT_HEALTH_POLICY_VERSION) {
    throw new DomainValidationError({ policyVersion: ['outdated'] });
  }
}
