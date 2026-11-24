import type { ChangePasswordRequest } from '@e-deep/shared';
import { IsPasswordInput } from '../../auth/dto/credential-rules';

/** Body of `PUT /api/me/password`. The policy answers on `newPassword` (D35). */
export class ChangePasswordRequestDto implements ChangePasswordRequest {
  @IsPasswordInput()
  currentPassword: string;

  @IsPasswordInput()
  newPassword: string;
}
