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
   * Six digits (`format`) here; verified against the account's secret, with anti-replay, by
   * `AuthenticationService.loginStaff` (D42).
   */
  @Required()
  @IsString()
  @ValidateBy({
    name: 'format',
    validator: { validate: (value: unknown) => typeof value === 'string' && TOTP_CODE.test(value) },
  })
  totpCode: string;
}
