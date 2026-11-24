import 'reflect-metadata';
import { Controller, Get, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import type { AppConfigService } from '../../config/app-config.service';
import type { NodeEnvironment } from '../../config/environment';
import type { OnboardingService } from '../../modules/accounts/onboarding.service';
import type { ResolvedSession, SessionService } from '../../modules/auth/session.service';
import {
  ConsentRequiredError,
  ForbiddenError,
  OnboardingRequiredError,
  UnauthenticatedError,
} from '../errors/domain-errors';
import { AllowIncompleteProfile } from './allow-incomplete-profile.decorator';
import { authContextOf } from './auth-context';
import type { DevAuthStub } from './dev-auth-stub';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import { SessionCookies } from './session-cookie';
import { SessionGuard } from './session.guard';

const TOKEN = 'Tk1aW1pKUq1Gk0pXs0cH3xqzU8wQe6R2yQm4vN9bL7s';
const OTHER_TOKEN = 'Zz9yX8wV7uT6sR5qP4oN3mL2kJ1iH0gF9eD8cB7aA6b';
const WEB_COOKIE = `edeep_sid=${TOKEN}`;
const ADMIN_COOKIE = `edeep_admin_sid=${TOKEN}`;
const NOW = new Date('2026-11-24T10:00:00.000Z');

const DIVER_SESSION: ResolvedSession = {
  sessionId: 'session-1',
  accountId: 'account-1',
  diverId: 'diver-1',
  role: 'diver',
  audience: 'web',
  lastSeenAt: NOW,
  expiresAt: new Date(NOW.getTime() + 86_400_000),
};
const SUPPORT_SESSION: ResolvedSession = {
  ...DIVER_SESSION,
  accountId: 'account-2',
  diverId: null,
  role: 'support',
  audience: 'admin',
};
const ADMIN_SESSION: ResolvedSession = { ...SUPPORT_SESSION, role: 'admin' };

// Routes of every kind, declared as the real controllers are.
@Controller('dives')
class LogbookController {
  @Get(':id')
  findOne(): void {}
}

@Controller('me')
@AllowIncompleteProfile()
class AccountController {
  @Get()
  describe(): void {}
}

@Controller('admin/me')
class AdminController {
  @Get()
  describe(): void {}

  @Get('accounts')
  @Roles('admin')
  adminsOnly(): void {}
}

@Controller('health')
@Public()
class PublicController {
  @Get()
  check(): void {}
}

@Controller(['dives', 'admin/dives'])
class AmbiguousController {
  @Get()
  list(): void {}
}

/** A controller class and the name of one of its handlers. */
type Route = readonly [controller: { readonly prototype: object }, method: string];
const LOGBOOK: Route = [LogbookController, 'findOne'];
const ACCOUNT: Route = [AccountController, 'describe'];
const ADMIN: Route = [AdminController, 'describe'];
const ADMIN_ONLY: Route = [AdminController, 'adminsOnly'];
const PUBLIC: Route = [PublicController, 'check'];
const AMBIGUOUS: Route = [AmbiguousController, 'list'];

const resolve = jest.fn<Promise<ResolvedSession | null>, [string, string]>();
const touch = jest.fn<Promise<boolean>, [ResolvedSession]>();
const statusOf = jest.fn<Promise<string>, [string]>();
const firstDiverAccount = jest.fn<Promise<{ accountId: string; diverId: string } | null>, []>();

interface GuardSettings {
  readonly devAuthStub?: boolean;
  readonly nodeEnv?: NodeEnvironment;
}

function guard({ devAuthStub = false, nodeEnv = 'development' }: GuardSettings = {}): SessionGuard {
  const values: Record<string, unknown> = {
    DEV_AUTH_STUB: devAuthStub,
    NODE_ENV: nodeEnv,
    SESSION_COOKIE_SECURE: false,
  };
  const config = { get: (key: string) => values[key] } as unknown as AppConfigService;
  return new SessionGuard(
    new Reflector(),
    new SessionCookies(config, { now: () => NOW }),
    { resolve, touch } as unknown as SessionService,
    { statusOf } as unknown as OnboardingService,
    { firstDiverAccount } as unknown as DevAuthStub,
    config,
  );
}

interface Call {
  readonly context: ExecutionContext;
  readonly request: Request;
  readonly setHeader: jest.Mock<void, [string, string]>;
}

function call([controller, method]: Route, cookie?: string, type = 'http'): Call {
  const handler: unknown = Reflect.get(controller.prototype, method);
  const request = { headers: { cookie } } as Request;
  const setHeader = jest.fn<void, [string, string]>();
  const response = { setHeader } as unknown as Response;
  const context = {
    getType: () => type,
    getClass: () => controller,
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
  return { context, request, setHeader };
}

describe('SessionGuard', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resolve.mockResolvedValue(null);
    touch.mockResolvedValue(false);
    statusOf.mockResolvedValue('complete');
    firstDiverAccount.mockResolvedValue(null);
  });

  it('refuses any context but HTTP', async () => {
    await expect(guard().canActivate(call(LOGBOOK, WEB_COOKIE, 'rpc').context)).resolves.toBe(
      false,
    );
    expect(resolve).not.toHaveBeenCalled();
  });

  it('lets a @Public route through without reading any session nor marking it no-store', async () => {
    const { context, request, setHeader } = call(PUBLIC);

    await expect(guard().canActivate(context)).resolves.toBe(true);
    expect(resolve).not.toHaveBeenCalled();
    expect(setHeader).not.toHaveBeenCalled();
    expect(authContextOf(request)).toBeUndefined();
  });

  describe('web routes', () => {
    it('401 without a cookie, marked no-store first, without any lookup', async () => {
      const { context, setHeader } = call(LOGBOOK);

      await expect(guard().canActivate(context)).rejects.toThrow(UnauthenticatedError);
      expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(resolve).not.toHaveBeenCalled();
    });

    it('401 for an unknown or expired session', async () => {
      await expect(guard().canActivate(call(LOGBOOK, WEB_COOKIE).context)).rejects.toThrow(
        UnauthenticatedError,
      );
      expect(resolve).toHaveBeenCalledWith(TOKEN, 'web');
      expect(touch).not.toHaveBeenCalled();
    });

    it('401 for two different web cookies (ambiguous), without any lookup', async () => {
      const cookie = `${WEB_COOKIE}; edeep_sid=${OTHER_TOKEN}`;

      await expect(guard().canActivate(call(LOGBOOK, cookie).context)).rejects.toThrow(
        UnauthenticatedError,
      );
      expect(resolve).not.toHaveBeenCalled();
    });

    it('401 with the admin cookie only: the audience comes from the path', async () => {
      resolve.mockResolvedValue(SUPPORT_SESSION);

      await expect(guard().canActivate(call(LOGBOOK, ADMIN_COOKIE).context)).rejects.toThrow(
        UnauthenticatedError,
      );
      expect(resolve).not.toHaveBeenCalled();
    });

    it('lets a complete diver through: touched, context attached with the branded diver', async () => {
      resolve.mockResolvedValue(DIVER_SESSION);
      const { context, request, setHeader } = call(LOGBOOK, WEB_COOKIE);

      await expect(guard().canActivate(context)).resolves.toBe(true);
      expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(touch).toHaveBeenCalledWith(DIVER_SESSION);
      expect(statusOf).toHaveBeenCalledWith('diver-1');
      expect(authContextOf(request)).toEqual({
        accountId: 'account-1',
        diverId: 'diver-1',
        role: 'diver',
        audience: 'web',
        sessionId: 'session-1',
      });
    });

    it.each([
      ['profile-required', OnboardingRequiredError],
      ['consent-required', ConsentRequiredError],
    ])('403 on the dive log for a %s profile, still touched', async (status, error) => {
      resolve.mockResolvedValue(DIVER_SESSION);
      statusOf.mockResolvedValue(status);
      const { context, request } = call(LOGBOOK, WEB_COOKIE);

      await expect(guard().canActivate(context)).rejects.toThrow(error);
      expect(touch).toHaveBeenCalledWith(DIVER_SESSION);
      expect(authContextOf(request)).toBeUndefined();
    });

    it('lets an incomplete profile reach an @AllowIncompleteProfile route, unchecked', async () => {
      resolve.mockResolvedValue(DIVER_SESSION);
      statusOf.mockResolvedValue('profile-required');

      await expect(guard().canActivate(call(ACCOUNT, WEB_COOKIE).context)).resolves.toBe(true);
      expect(statusOf).not.toHaveBeenCalled();
    });

    it('403 forbidden for a staff session resolved on the web audience (defence in depth)', async () => {
      resolve.mockResolvedValue({ ...SUPPORT_SESSION, audience: 'web' });

      await expect(guard().canActivate(call(ACCOUNT, WEB_COOKIE).context)).rejects.toThrow(
        ForbiddenError,
      );
      expect(touch).not.toHaveBeenCalled();
    });
  });

  describe('admin routes', () => {
    it('401 with the web cookie only', async () => {
      resolve.mockResolvedValue(DIVER_SESSION);

      await expect(guard().canActivate(call(ADMIN, WEB_COOKIE).context)).rejects.toThrow(
        UnauthenticatedError,
      );
      expect(resolve).not.toHaveBeenCalled();
    });

    it('lets a staff session through on the admin audience, without onboarding check', async () => {
      resolve.mockResolvedValue(SUPPORT_SESSION);
      const { context, request } = call(ADMIN, ADMIN_COOKIE);

      await expect(guard().canActivate(context)).resolves.toBe(true);
      expect(resolve).toHaveBeenCalledWith(TOKEN, 'admin');
      expect(touch).toHaveBeenCalledWith(SUPPORT_SESSION);
      expect(statusOf).not.toHaveBeenCalled();
      expect(authContextOf(request)).toMatchObject({ role: 'support', diverId: null });
    });

    it('403 forbidden for a diver session resolved on the admin audience (defence in depth)', async () => {
      resolve.mockResolvedValue({ ...DIVER_SESSION, audience: 'admin' });

      await expect(guard().canActivate(call(ADMIN, ADMIN_COOKIE).context)).rejects.toThrow(
        ForbiddenError,
      );
      expect(touch).not.toHaveBeenCalled();
    });

    it('@Roles narrows the staff roles: 403 for support, through for admin', async () => {
      resolve.mockResolvedValue(SUPPORT_SESSION);
      await expect(guard().canActivate(call(ADMIN_ONLY, ADMIN_COOKIE).context)).rejects.toThrow(
        ForbiddenError,
      );

      resolve.mockResolvedValue(ADMIN_SESSION);
      await expect(guard().canActivate(call(ADMIN_ONLY, ADMIN_COOKIE).context)).resolves.toBe(true);
    });
  });

  it('refuses to guess the audience of a route with several paths (500)', async () => {
    await expect(guard().canActivate(call(AMBIGUOUS, WEB_COOKIE).context)).rejects.toThrow(
      'Unsupported route path metadata',
    );
    expect(resolve).not.toHaveBeenCalled();
  });

  describe('DEV_AUTH_STUB fallback (until lot 6)', () => {
    const STUB_ACCOUNT = { accountId: 'account-9', diverId: 'diver-9' };
    const stubbed = (nodeEnv: NodeEnvironment = 'development') =>
      guard({ devAuthStub: true, nodeEnv });

    it('acts for the first diver without any cookie, with no session', async () => {
      firstDiverAccount.mockResolvedValue(STUB_ACCOUNT);
      const { context, request, setHeader } = call(ACCOUNT);

      await expect(stubbed().canActivate(context)).resolves.toBe(true);
      expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
      expect(resolve).not.toHaveBeenCalled();
      expect(touch).not.toHaveBeenCalled();
      expect(authContextOf(request)).toEqual({
        accountId: 'account-9',
        diverId: 'diver-9',
        role: 'diver',
        audience: 'web',
        sessionId: null,
      });
    });

    it('still goes through the onboarding checks on the dive log', async () => {
      firstDiverAccount.mockResolvedValue(STUB_ACCOUNT);
      statusOf.mockResolvedValue('consent-required');

      await expect(stubbed().canActivate(call(LOGBOOK).context)).rejects.toThrow(
        ConsentRequiredError,
      );
      expect(statusOf).toHaveBeenCalledWith('diver-9');
    });

    it('401 when the first diver has no account', async () => {
      await expect(stubbed().canActivate(call(LOGBOOK).context)).rejects.toThrow(
        UnauthenticatedError,
      );
      expect(firstDiverAccount).toHaveBeenCalled();
    });

    it('does not apply once a web cookie is presented, even an invalid one', async () => {
      firstDiverAccount.mockResolvedValue(STUB_ACCOUNT);

      await expect(
        stubbed().canActivate(call(LOGBOOK, 'edeep_sid=garbage').context),
      ).rejects.toThrow(UnauthenticatedError);
      expect(firstDiverAccount).not.toHaveBeenCalled();
    });

    it.each([
      ['an empty web cookie', 'edeep_sid='],
      ['the web cookie under the secure name', `__Host-edeep_sid=${TOKEN}`],
      ['an empty web cookie under the secure name', '__Host-edeep_sid='],
    ])('does not apply with %s either', async (_case, cookie) => {
      firstDiverAccount.mockResolvedValue(STUB_ACCOUNT);

      await expect(stubbed().canActivate(call(LOGBOOK, cookie).context)).rejects.toThrow(
        UnauthenticatedError,
      );
      expect(firstDiverAccount).not.toHaveBeenCalled();
    });

    it('still applies with the admin cookie only (another audience)', async () => {
      firstDiverAccount.mockResolvedValue(STUB_ACCOUNT);

      await expect(stubbed().canActivate(call(ACCOUNT, ADMIN_COOKIE).context)).resolves.toBe(true);
    });

    it('never applies to the admin audience', async () => {
      firstDiverAccount.mockResolvedValue(STUB_ACCOUNT);

      await expect(stubbed().canActivate(call(ADMIN).context)).rejects.toThrow(
        UnauthenticatedError,
      );
      expect(firstDiverAccount).not.toHaveBeenCalled();
    });

    it('is refused in production even when the variable is set', async () => {
      firstDiverAccount.mockResolvedValue(STUB_ACCOUNT);

      await expect(stubbed('production').canActivate(call(LOGBOOK).context)).rejects.toThrow(
        UnauthenticatedError,
      );
      expect(firstDiverAccount).not.toHaveBeenCalled();
    });

    it('is off without the variable', async () => {
      firstDiverAccount.mockResolvedValue(STUB_ACCOUNT);

      await expect(guard().canActivate(call(LOGBOOK).context)).rejects.toThrow(
        UnauthenticatedError,
      );
      expect(firstDiverAccount).not.toHaveBeenCalled();
    });
  });
});
