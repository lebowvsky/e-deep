import type { HealthPolicyVersion, OnboardingRequest } from '@e-deep/shared';
import { IsBoolean, IsIn, IsUUID } from 'class-validator';
import { IsText, Nullable, Required } from '../../../common/validation/field-rules';
import { HEALTH_POLICY_VERSIONS } from '../../consents/health-policy-versions';

/** `ck_divers__last_name`: at most 100 characters; blank is stored as `null` by the service. */
const LAST_NAME_MAX_LENGTH = 100;

/** Body of `POST /api/me/onboarding`, sent from `/welcome` (D38). */
export class OnboardingRequestDto implements OnboardingRequest {
  @Nullable()
  @IsText(0, LAST_NAME_MAX_LENGTH)
  lastName: string | null;

  @Required()
  @IsUUID('all')
  certificationLevelId: string;

  /** The dedicated checkbox, never pre-checked: only `true` is accepted (`in`). */
  @Required()
  @IsBoolean()
  @IsIn([true])
  healthDataConsent: true;

  /** A known version (`in`); the service refuses one that is not current (`outdated`). */
  @Required()
  @IsIn(HEALTH_POLICY_VERSIONS)
  policyVersion: HealthPolicyVersion;
}
