import type { LoginRequest } from '@e-deep/shared';
import { IsBoolean } from 'class-validator';
import { Required } from '../../../common/validation/field-rules';
import { IsEmailAddress, IsPasswordInput } from './credential-rules';

/** Body of `POST /api/auth/login`. */
export class LoginRequestDto implements LoginRequest {
  @IsEmailAddress()
  email: string;

  @IsPasswordInput()
  password: string;

  /** « Rester connecté » (D33): required, the front sends its checkbox (checked by default). */
  @Required()
  @IsBoolean()
  rememberMe: boolean;
}
