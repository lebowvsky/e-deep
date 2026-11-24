import type { AdminLoginRequest } from '@e-deep/shared';
import { IsString, ValidateBy } from 'class-validator';
import { Required } from '../../../common/validation/field-rules';
import { IsEmailAddress, IsPasswordInput } from './credential-rules';

/** RFC 6238 code of the authenticator app: six digits. */
const TOTP_CODE = /^\d{6}$/;

/** Body of `POST /api/admin/auth/login` (D42). */
export class AdminLoginRequestDto implements AdminLoginRequest {
  @IsEmailAddress()
  email: string;

  @IsPasswordInput()
  password: string;

  /**
   * Required and format-checked (`format`) now, but NOT verified until lot 7: see the
   * `TODO(lot 7)` of `AuthenticationService`.
   */
  @Required()
  @IsString()
  @ValidateBy({
    name: 'format',
    validator: { validate: (value: unknown) => typeof value === 'string' && TOTP_CODE.test(value) },
  })
  totpCode: string;
}
