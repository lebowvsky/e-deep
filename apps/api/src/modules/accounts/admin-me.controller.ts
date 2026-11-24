import type { AdminMeResponse } from '@e-deep/shared';
import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  AdminSessionGuard,
  CurrentStaffSession,
  type StaffSession,
} from '../../common/auth/local-session.guard';
import { ForbiddenError } from '../../common/errors/domain-errors';
import { isStaffRole } from './account-lists';
import { AccountsService } from './accounts.service';
import { toAdminMeResponse } from './me-contract.mapper';

/**
 * Identity of the signed-in staff member on the back office (§3, D42), from the admin cookie only.
 * Staff roles only (`@Roles('support', 'admin')` with lot 4). Reads no health data.
 */
@Controller('admin/me')
@UseGuards(AdminSessionGuard)
export class AdminMeController {
  constructor(private readonly accounts: AccountsService) {}

  /** `GET /api/admin/me`. */
  @Get()
  async describe(@CurrentStaffSession() session: StaffSession): Promise<AdminMeResponse> {
    const { email, role } = await this.accounts.identityOf(session.accountId);
    // The role is read again: one changed since the session was resolved is refused.
    if (!isStaffRole(role)) {
      throw new ForbiddenError();
    }
    return toAdminMeResponse(email, role);
  }
}
