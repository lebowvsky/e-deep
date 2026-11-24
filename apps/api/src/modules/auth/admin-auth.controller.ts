import type { AdminMeResponse } from '@e-deep/shared';
import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { clientIpKey } from '../../common/auth/client-ip';
import { NoStoreGuard } from '../../common/auth/no-store.guard';
import { Public } from '../../common/auth/public.decorator';
import { SessionCookies } from '../../common/auth/session-cookie';
import { isStaffRole } from '../accounts/account-lists';
import { toAdminMeResponse } from '../accounts/me-contract.mapper';
import { AuthenticationService } from './authentication.service';
import { AdminLoginRequestDto } from './dto/admin-login-request.dto';

/**
 * Sign-in and sign-out of the staff on the back office (§3, D42), with the admin cookie only.
 * Public routes (the `OriginGuard` still applies), every answer `no-store`.
 *
 * The TOTP code is required and format-checked but NOT verified yet: lot 7 (see the `TODO(lot 7)`
 * of `AuthenticationService`).
 */
@Controller('admin/auth')
@Public()
@UseGuards(NoStoreGuard)
export class AdminAuthController {
  constructor(
    private readonly authentication: AuthenticationService,
    private readonly cookies: SessionCookies,
  ) {}

  /** `POST /api/admin/auth/login`: 200 with a short browser-session cookie (D42). */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: AdminLoginRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AdminMeResponse> {
    const { account, session } = await this.authentication.loginStaff({
      email: body.email,
      password: body.password,
      totpCode: body.totpCode,
      ip: clientIpKey(request.ip),
      replacedTokens: this.cookies.presentedTokens(request, 'admin'),
    });
    const { role } = account;
    // `loginStaff` refuses any other role: unreachable, but never answer a diver as staff.
    if (!isStaffRole(role)) {
      throw new Error('Admin session opened for a diver account');
    }
    // Built before the cookie, like the web login.
    const me = toAdminMeResponse(account.email, role);
    this.cookies.write(response, 'admin', session);
    return me;
  }

  /** `POST /api/admin/auth/logout`: 204, idempotent; the admin cookie is cleared in every case. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const tokens = this.cookies.presentedTokens(request, 'admin');
    this.cookies.clear(response, 'admin');
    await this.authentication.signOut(tokens, 'admin');
  }
}
