import type { RegisterRequest } from '@e-deep/shared';
import { IsText, Required } from '../../../common/validation/field-rules';
import { IsEmailAddress, IsPasswordInput } from './credential-rules';

/** §3: 1 to 40 characters (within `ck_divers__first_name`, 1 to 100). */
const FIRST_NAME_LENGTH = { min: 1, max: 40 } as const;

/** Body of `POST /api/auth/register`: the minimal sign-up (D36). */
export class RegisterRequestDto implements RegisterRequest {
  @Required()
  @IsText(FIRST_NAME_LENGTH.min, FIRST_NAME_LENGTH.max)
  firstName: string;

  @IsEmailAddress()
  email: string;

  @IsPasswordInput()
  password: string;
}
