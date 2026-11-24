import type { ConsentGrantRequest, ConsentPurpose, HealthPolicyVersion } from '@e-deep/shared';
import { IsIn } from 'class-validator';
import { Required } from '../../../common/validation/field-rules';
import { CONSENT_PURPOSES } from '../../consents/consent-purposes';
import { HEALTH_POLICY_VERSIONS } from '../../consents/health-policy-versions';

/** Body of `POST /api/me/consents` (re-consent to the current policy version, D38). */
export class ConsentGrantRequestDto implements ConsentGrantRequest {
  @Required()
  @IsIn(CONSENT_PURPOSES)
  purpose: ConsentPurpose;

  /** A known version (`in`); the service refuses one that is not current (`outdated`). */
  @Required()
  @IsIn(HEALTH_POLICY_VERSIONS)
  policyVersion: HealthPolicyVersion;
}
