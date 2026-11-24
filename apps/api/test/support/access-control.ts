import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DevAuthStub } from '../../src/common/auth/dev-auth-stub';
import { JsonBodyGuard } from '../../src/common/auth/json-body.guard';
import { OriginGuard } from '../../src/common/auth/origin.guard';
import { SessionCookies } from '../../src/common/auth/session-cookie';
import { SessionGuard } from '../../src/common/auth/session.guard';
import { CLOCK, type Clock } from '../../src/common/time/clock';
import type { NodeEnvironment } from '../../src/config/environment';
import { OnboardingService } from '../../src/modules/accounts/onboarding.service';
import { SessionService, type ResolvedSession } from '../../src/modules/auth/session.service';

// E2e harness of the global guards (auth lot 4): the real `OriginGuard`, `SessionGuard` and
// `SessionCookies`, on a fake `SessionService` (D44), a fake onboarding status and a fake
// `DevAuthStub`. No database.

export const NOW = new Date('2026-11-24T10:00:00.000Z');
export const WEB_ORIGIN = 'http://localhost:5173';

export const TOKEN = 'Tk1aW1pKUq1Gk0pXs0cH3xqzU8wQe6R2yQm4vN9bL7s';
export const ACCOUNT_ID = '01900000-0000-7000-8000-0000000000c1';
export const DIVER_ID = '01900000-0000-7000-8000-000000000001';
export const SESSION_ID = '01900000-0000-7000-8000-0000000000e1';
export const STAFF_ACCOUNT_ID = '01900000-0000-7000-8000-0000000000c2';

/** Cookies of the insecure (local http) names, `SESSION_COOKIE_SECURE=false`. */
export const WEB_COOKIE = `edeep_sid=${TOKEN}`;
export const ADMIN_COOKIE = `edeep_admin_sid=${TOKEN}`;

export const DIVER_SESSION: ResolvedSession = {
  sessionId: SESSION_ID,
  accountId: ACCOUNT_ID,
  diverId: DIVER_ID,
  role: 'diver',
  audience: 'web',
  lastSeenAt: NOW,
  expiresAt: new Date(NOW.getTime() + 180 * 86_400_000),
};

export const STAFF_SESSION: ResolvedSession = {
  sessionId: SESSION_ID,
  accountId: STAFF_ACCOUNT_ID,
  diverId: null,
  role: 'support',
  audience: 'admin',
  lastSeenAt: NOW,
  expiresAt: new Date(NOW.getTime() + 86_400_000),
};

export const sessionFakes = { resolve: jest.fn(), touch: jest.fn() };
export const onboardingFakes = { statusOf: jest.fn(), stateOf: jest.fn(), complete: jest.fn() };
export const devAuthStubFake = { firstDiverAccount: jest.fn() };

/** Defaults: no live session, a complete profile, no first diver for the stub. */
export function resetAccessControlFakes(): void {
  sessionFakes.resolve.mockReset().mockResolvedValue(null);
  sessionFakes.touch.mockReset().mockResolvedValue(false);
  onboardingFakes.statusOf.mockReset().mockResolvedValue('complete');
  onboardingFakes.stateOf.mockReset();
  onboardingFakes.complete.mockReset();
  devAuthStubFake.firstDiverAccount.mockReset().mockResolvedValue(null);
}

/** The web cookie resolves to `session` (a signed-in diver by default). */
export function signIn(session: ResolvedSession = DIVER_SESSION): void {
  sessionFakes.resolve.mockResolvedValue(session);
}

export interface TestSettings {
  readonly secureCookies?: boolean;
  readonly devAuthStub?: boolean;
  readonly nodeEnv?: NodeEnvironment;
  readonly allowedOrigins?: readonly string[];
}

/** A `ConfigService` answering the variables the guards and the cookies read. */
export function testConfig({
  secureCookies = false,
  devAuthStub = false,
  nodeEnv = 'test',
  allowedOrigins = [WEB_ORIGIN],
}: TestSettings = {}): { get: (key: string) => unknown } {
  const values: Readonly<Record<string, unknown>> = {
    SESSION_COOKIE_SECURE: secureCookies,
    DEV_AUTH_STUB: devAuthStub,
    NODE_ENV: nodeEnv,
    ALLOWED_ORIGINS: allowedOrigins,
  };
  return { get: (key) => values[key] };
}

/**
 * The global guards as `AppModule` registers them (`AccessControlModule`: `OriginGuard`,
 * `JsonBodyGuard`, then `SessionGuard`), with their dependencies faked, and the config.
 */
export function accessControlProviders(settings: TestSettings = {}): Provider[] {
  const clock: Clock = { now: () => NOW };
  return [
    SessionCookies,
    { provide: CLOCK, useValue: clock },
    { provide: ConfigService, useValue: testConfig(settings) },
    { provide: SessionService, useValue: sessionFakes },
    { provide: OnboardingService, useValue: onboardingFakes },
    { provide: DevAuthStub, useValue: devAuthStubFake },
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: JsonBodyGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
  ];
}

/**
 * A supertest agent whose every request is a same-origin browser request
 * (`Sec-Fetch-Site: same-origin`), as the `OriginGuard` requires on unsafe methods.
 */
export function sameOrigin(app: NestExpressApplication): ReturnType<typeof request.agent> {
  return request.agent(app.getHttpServer()).set('Sec-Fetch-Site', 'same-origin');
}
