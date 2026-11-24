import type { HealthPolicyVersion } from '@e-deep/shared';
import {
  CURRENT_HEALTH_POLICY_VERSION,
  HEALTH_POLICY_VERSIONS,
  isHealthPolicyVersion,
} from './health-policy-versions';

// `Record<HealthPolicyVersion, …>` does not compile if a version of the shared union is missing here.
const EVERY_VERSION: Record<HealthPolicyVersion, true> = { '2026-11': true };

describe('HEALTH_POLICY_VERSIONS', () => {
  it('lists every HealthPolicyVersion of the shared contract', () => {
    expect([...HEALTH_POLICY_VERSIONS].sort()).toEqual(Object.keys(EVERY_VERSION).sort());
  });

  it('contains the current version', () => {
    expect(HEALTH_POLICY_VERSIONS).toContain(CURRENT_HEALTH_POLICY_VERSION);
  });
});

describe('isHealthPolicyVersion', () => {
  it('accepts a known version and refuses anything else', () => {
    expect(isHealthPolicyVersion('2026-11')).toBe(true);
    for (const value of ['2026-10', '2026-11 ', '', 'v1']) {
      expect(isHealthPolicyVersion(value)).toBe(false);
    }
  });
});
