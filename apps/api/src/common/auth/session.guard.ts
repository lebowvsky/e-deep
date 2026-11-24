import type { AccountRole } from '@e-deep/shared';
import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { AppConfigService } from '../../config/app-config.service';
import { STAFF_ROLES } from '../../modules/accounts/account-lists';
import { OnboardingService } from '../../modules/accounts/onboarding.service';
import type { SessionAudience } from '../../modules/auth/session-audiences';
import { SessionService, type ResolvedSession } from '../../modules/auth/session.service';
import {
  ConsentRequiredError,
  ForbiddenError,
  OnboardingRequiredError,
  UnauthenticatedError,
} from '../errors/domain-errors';
import { ALLOW_INCOMPLETE_PROFILE_KEY } from './allow-incomplete-profile.decorator';
import {
  attachAuthContext,
  authContextOfSession,
  devStubAuthContext,
  type AuthContext,
} from './auth-context';
import { DevAuthStub } from './dev-auth-stub';
import { IS_PUBLIC_KEY } from './public.decorator';
import { audienceOfPath, routePath } from './route-audience';
import { ROLES_KEY } from './roles.decorator';
import { SessionCookies } from './session-cookie';

/** Roles an audience serves when the route does not narrow them with `@Roles`. */
const AUDIENCE_ROLES = {
  web: ['diver'],
  admin: STAFF_ROLES,
} as const satisfies Record<SessionAudience, readonly AccountRole[]>;

interface Authenticated {
  readonly auth: AuthContext;
  /** `null` for the `DEV_AUTH_STUB` fallback: nothing to touch. */
  readonly session: ResolvedSession | null;
}

/**
 * Global guard (`APP_GUARD`): every route needs a session unless it is `@Public()` (D37, refusal
 * by default). In order:
 * 1. `Cache-Control: no-store` on the response, so it is also on every error that follows (this
 *    guard's, the pipes', the handler's);
 * 2. the audience from the route path (`/api/admin/*`: admin cookie only, any other: web cookie
 *    only), then the session of that cookie (`SessionService.resolve`): `401 unauthenticated`
 *    without a single live one. DEVELOPMENT fallback (until lot 6): no web cookie at all (under
 *    either name, empty ones included),
 *    `DEV_AUTH_STUB=true` and `NODE_ENV≠production` act for the first diver;
 * 3. the role (`@Roles`, or the audience's roles by default): `403 forbidden` otherwise;
 * 4. the activity (`touch`), once the role is accepted;
 * 5. on a web route without `@AllowIncompleteProfile()` (the dive log): the onboarding status,
 *    `403 onboarding-required` or `403 consent-required` until it is `complete` (D38);
 * 6. the `AuthContext` handed to the handler (`@CurrentAuth()`, `@CurrentDiverId()`).
 *
 * Logs nothing: a refusal is an answer, not an event, and the request carries personal data.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  private readonly devStubEnabled: boolean;

  constructor(
    private readonly reflector: Reflector,
    private readonly cookies: SessionCookies,
    private readonly sessions: SessionService,
    private readonly onboarding: OnboardingService,
    private readonly devAuthStub: DevAuthStub,
    @Inject(ConfigService) config: AppConfigService,
  ) {
    // The environment validation already refuses the stub in production; checked again here so
    // that no configuration path can turn it on there.
    this.devStubEnabled =
      config.get('DEV_AUTH_STUB', { infer: true }) &&
      config.get('NODE_ENV', { infer: true }) !== 'production';
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return false;
    }
    if (this.flag(context, IS_PUBLIC_KEY)) {
      return true;
    }
    const http = context.switchToHttp();
    http.getResponse<Response>().setHeader('Cache-Control', 'no-store');
    const request = http.getRequest<Request>();
    const audience = audienceOfPath(
      routePath(this.reflector, context.getClass(), context.getHandler()),
    );

    const { auth, session } = await this.authenticate(request, audience);
    if (!this.allowedRoles(context, audience).includes(auth.role)) {
      throw new ForbiddenError();
    }
    if (session !== null) {
      await this.sessions.touch(session);
    }
    if (audience === 'web' && !this.flag(context, ALLOW_INCOMPLETE_PROFILE_KEY)) {
      await this.assertOnboarded(auth);
    }
    attachAuthContext(request, auth);
    return true;
  }

  /**
   * The context of the audience's session (and the session, to touch it); the stub fallback, with
   * no session, when no web cookie is presented at all.
   */
  private async authenticate(request: Request, audience: SessionAudience): Promise<Authenticated> {
    if (this.devStubEnabled && audience === 'web') {
      if (!this.cookies.presentsAnyCookie(request, audience)) {
        const account = await this.devAuthStub.firstDiverAccount();
        if (account === null) {
          throw new UnauthenticatedError();
        }
        return { auth: devStubAuthContext(account), session: null };
      }
    }
    const token = this.cookies.token(request, audience);
    const session = token === null ? null : await this.sessions.resolve(token, audience);
    if (session === null) {
      throw new UnauthenticatedError();
    }
    return { auth: authContextOfSession(session), session };
  }

  private async assertOnboarded(auth: AuthContext): Promise<void> {
    if (auth.diverId === null) {
      throw new ForbiddenError();
    }
    const status = await this.onboarding.statusOf(auth.diverId);
    if (status === 'profile-required') {
      throw new OnboardingRequiredError();
    }
    if (status === 'consent-required') {
      throw new ConsentRequiredError();
    }
  }

  private allowedRoles(
    context: ExecutionContext,
    audience: SessionAudience,
  ): readonly AccountRole[] {
    const roles = this.reflector.getAllAndOverride<readonly AccountRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const audienceRoles: readonly AccountRole[] = AUDIENCE_ROLES[audience];
    // `@Roles` narrows the audience's roles, it never widens them (no diver on an admin route).
    return roles === undefined
      ? audienceRoles
      : roles.filter((role) => audienceRoles.includes(role));
  }

  private flag(context: ExecutionContext, key: string): boolean {
    return (
      this.reflector.getAllAndOverride<boolean | undefined>(key, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
