import type { DeleteAccountRequest } from '@e-deep/shared';
import { IsPasswordInput } from '../../auth/dto/credential-rules';

/** Body of `DELETE /api/me`: the password is typed again (D38). */
export class DeleteAccountRequestDto implements DeleteAccountRequest {
  @IsPasswordInput()
  password: string;
}
