import type { MeResponse } from '@e-deep/shared';
import { Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { clientIpKey } from '../../common/auth/client-ip';
import { AllowIncompleteProfile } from '../../common/auth/allow-incomplete-profile.decorator';
import type { AuthContext } from '../../common/auth/auth-context';
import { CurrentAuth } from '../../common/auth/current-diver-id.decorator';
import { NoStoreGuard } from '../../common/auth/no-store.guard';
import { Public } from '../../common/auth/public.decorator';
import { SessionCookies } from '../../common/auth/session-cookie';
import { MeService } from '../accounts/me.service';
import type { AuthenticatedAccount } from './authenticated-account';
import { AuthenticationService } from './authentication.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { RegistrationService } from './registration.service';

/**
 * Sign-up, sign-in and sign-out of the divers (§3, D33, D39). Every answer is `no-store`. The
 * cookie is the only carrier of the token: the body never contains it.
 *
 * `register`, `login` and `logout` are `@Public` (the `OriginGuard` still applies); `logout-all`
 * needs a web session, even before `/welcome`.
 */
@Controller('auth')
@UseGuards(NoStoreGuard)
export class AuthController {
  constructor(
    private readonly registration: RegistrationService,
    private readonly authentication: AuthenticationService,
    private readonly cookies: SessionCookies,
    private readonly me: MeService,
  ) {}

  /**
   * `POST /api/auth/register`: 201, signed in with a persistent session, `/welcome` next; the web
   * cookie already presented is revoked (rotation, like a login).
   */
  @Post('register')
  @Public()
  async register(
    @Body() body: RegisterRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MeResponse> {
    const { account, session } = await this.registration.register({
      firstName: body.firstName,
      email: body.email,
      password: body.password,
      ip: clientIpKey(request.ip),
      replacedTokens: this.cookies.presentedTokens(request, 'web'),
    });
    // Built before the cookie: if it fails, the 500 does not leave the browser signed in.
    const me = await this.me.describeAccount(account.email, diverIdOf(account));
    this.cookies.write(response, 'web', session);
    return me;
  }

  /** `POST /api/auth/login`: 200; the cookie already presented is revoked (rotation). */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() body: LoginRequestDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<MeResponse> {
    const { account, session } = await this.authentication.loginDiver({
      email: body.email,
      password: body.password,
      rememberMe: body.rememberMe,
      ip: clientIpKey(request.ip),
      replacedTokens: this.cookies.presentedTokens(request, 'web'),
    });
    // Built before the cookie: if it fails, the 500 does not leave the browser signed in.
    const me = await this.me.describeAccount(account.email, diverIdOf(account));
    this.cookies.write(response, 'web', session);
    return me;
  }

  /** `POST /api/auth/logout`: 204, idempotent; the cookie is cleared in every case. */
  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const tokens = this.cookies.presentedTokens(request, 'web');
    this.cookies.clear(response, 'web');
    await this.authentication.signOut(tokens, 'web');
  }

  /** `POST /api/auth/logout-all`: 204, every session of the account ended, this one included. */
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AllowIncompleteProfile()
  async logoutAll(
    @CurrentAuth() auth: AuthContext,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    // Revoked first: on a failure, the 500 keeps the cookie of the sessions still alive.
    await this.authentication.signOutEverywhere(auth.accountId);
    this.cookies.clear(response, 'web');
  }
}

/** A web sign-in or sign-up is always a diver's (the services refuse any other role). */
function diverIdOf(account: AuthenticatedAccount): string {
  if (account.diverId === null) {
    throw new Error('Web session opened for an account without a diver');
  }
  return account.diverId;
}
