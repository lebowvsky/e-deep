import type { MeResponse } from '@e-deep/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { clientIpKey } from '../../common/auth/client-ip';
import { AllowIncompleteProfile } from '../../common/auth/allow-incomplete-profile.decorator';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentAuth, CurrentDiverId } from '../../common/auth/current-diver-id.decorator';
import type { DiverId } from '../../common/auth/diver-id';
import { SessionCookies } from '../../common/auth/session-cookie';
import { ConsentsService } from '../consents/consents.service';
import { AccountsService, type AccountCaller } from './accounts.service';
import { ChangePasswordRequestDto } from './dto/change-password-request.dto';
import { ConsentGrantRequestDto } from './dto/consent-grant-request.dto';
import { DeleteAccountRequestDto } from './dto/delete-account-request.dto';
import { OnboardingRequestDto } from './dto/onboarding-request.dto';
import { MeService } from './me.service';
import { OnboardingService } from './onboarding.service';

/**
 * The signed-in diver's account (§3, D38, D41), reachable before `/welcome` (an incomplete profile
 * is the point of `onboarding`): web session, `@AllowIncompleteProfile()`. The diver always comes
 * from the session (`@CurrentDiverId()`), never from the request; every answer is `no-store` (set
 * by the `SessionGuard`, errors included).
 */
@Controller('me')
@AllowIncompleteProfile()
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly accounts: AccountsService,
    private readonly consents: ConsentsService,
    private readonly cookies: SessionCookies,
    private readonly onboarding: OnboardingService,
  ) {}

  /** `GET /api/me`. */
  @Get()
  describe(
    @CurrentAuth() auth: AuthContext,
    @CurrentDiverId() diverId: DiverId,
  ): Promise<MeResponse> {
    return this.me.describe(auth.accountId, diverId);
  }

  /** `POST /api/me/onboarding`: 200, level, last name and consent in one transaction. */
  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  async completeOnboarding(
    @CurrentAuth() auth: AuthContext,
    @CurrentDiverId() diverId: DiverId,
    @Body() body: OnboardingRequestDto,
  ): Promise<MeResponse> {
    const state = await this.onboarding.complete({
      accountId: auth.accountId,
      diverId,
      lastName: body.lastName,
      certificationLevelId: body.certificationLevelId,
      policyVersion: body.policyVersion,
    });
    return this.me.describeWith(auth.accountId, state);
  }

  /** `POST /api/me/consents`: 201, consent to the current policy version (re-consent). */
  @Post('consents')
  async grantConsent(
    @CurrentAuth() auth: AuthContext,
    @CurrentDiverId() diverId: DiverId,
    @Body() body: ConsentGrantRequestDto,
  ): Promise<MeResponse> {
    await this.consents.grant({
      accountId: auth.accountId,
      diverId,
      purpose: body.purpose,
      policyVersion: body.policyVersion,
    });
    return this.me.describe(auth.accountId, diverId);
  }

  /** `PUT /api/me/password`: 204, the other sessions revoked, this cookie rotated. */
  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentAuth() auth: AuthContext,
    @Body() body: ChangePasswordRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const rotated = await this.accounts.changePassword(callerOf(auth, request), {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    this.cookies.write(response, 'web', rotated);
  }

  /** `DELETE /api/me`: 204, the diver and everything it owns erased (art. 17), cookie cleared. */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentAuth() auth: AuthContext,
    @Body() body: DeleteAccountRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.accounts.deleteAccount(callerOf(auth, request), body.password);
    this.cookies.clear(response, 'web');
  }
}

/** The caller of a password-checked account route: its session is rotated or ended. */
function callerOf(auth: AuthContext, request: Request): AccountCaller {
  return {
    accountId: auth.accountId,
    sessionId: auth.sessionId,
    ip: clientIpKey(request.ip),
  };
}
