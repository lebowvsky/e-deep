import type { AdminMeResponse } from '@e-deep/shared';
import { Controller, Get } from '@nestjs/common';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentAuth } from '../../common/auth/current-diver-id.decorator';
import { Roles } from '../../common/auth/roles.decorator';
import { ForbiddenError } from '../../common/errors/domain-errors';
import { isStaffRole } from './account-lists';
import { AccountsService } from './accounts.service';
import { toAdminMeResponse } from './me-contract.mapper';

/**
 * Identity of the signed-in staff member on the back office (§3, D42), from the admin cookie only
 * (the `SessionGuard` reads the audience from the `admin/` path). Staff roles only. Reads no health
 * data.
 */
@Controller('admin/me')
@Roles('support', 'admin')
export class AdminMeController {
  constructor(private readonly accounts: AccountsService) {}

  /** `GET /api/admin/me`. */
  @Get()
  async describe(@CurrentAuth() auth: AuthContext): Promise<AdminMeResponse> {
    const { email, role } = await this.accounts.identityOf(auth.accountId);
    // The role is read again: one changed since the session was resolved is refused.
    if (!isStaffRole(role)) {
      throw new ForbiddenError();
    }
    return toAdminMeResponse(email, role);
  }
}
