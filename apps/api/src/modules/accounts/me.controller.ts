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
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { clientIpKey } from '../../common/auth/client-ip';
import {
  CurrentDiverSession,
  WebSessionGuard,
  type DiverSession,
} from '../../common/auth/local-session.guard';
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
 * is the point of `onboarding`). The diver always comes from the session, never from the request;
 * every answer is `no-store` (set by the guard, errors included).
 */
@Controller('me')
@UseGuards(WebSessionGuard)
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
  describe(@CurrentDiverSession() session: DiverSession): Promise<MeResponse> {
    return this.me.describe(session.accountId, session.diverId);
  }

  /** `POST /api/me/onboarding`: 200, level, last name and consent in one transaction. */
  @Post('onboarding')
  @HttpCode(HttpStatus.OK)
  async completeOnboarding(
    @CurrentDiverSession() session: DiverSession,
    @Body() body: OnboardingRequestDto,
  ): Promise<MeResponse> {
    const state = await this.onboarding.complete({
      accountId: session.accountId,
      diverId: session.diverId,
      lastName: body.lastName,
      certificationLevelId: body.certificationLevelId,
      policyVersion: body.policyVersion,
    });
    return this.me.describeWith(session.accountId, state);
  }

  /** `POST /api/me/consents`: 201, consent to the current policy version (re-consent). */
  @Post('consents')
  async grantConsent(
    @CurrentDiverSession() session: DiverSession,
    @Body() body: ConsentGrantRequestDto,
  ): Promise<MeResponse> {
    await this.consents.grant({
      accountId: session.accountId,
      diverId: session.diverId,
      purpose: body.purpose,
      policyVersion: body.policyVersion,
    });
    return this.me.describe(session.accountId, session.diverId);
  }

  /** `PUT /api/me/password`: 204, the other sessions revoked, this cookie rotated. */
  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentDiverSession() session: DiverSession,
    @Body() body: ChangePasswordRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const rotated = await this.accounts.changePassword(callerOf(session, request), {
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    this.cookies.write(response, 'web', rotated);
  }

  /** `DELETE /api/me`: 204, the diver and everything it owns erased (art. 17), cookie cleared. */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentDiverSession() session: DiverSession,
    @Body() body: DeleteAccountRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.accounts.deleteAccount(callerOf(session, request), body.password);
    this.cookies.clear(response, 'web');
  }
}

function callerOf(session: DiverSession, request: Request): AccountCaller {
  return {
    accountId: session.accountId,
    sessionId: session.sessionId,
    ip: clientIpKey(request.ip),
  };
}
