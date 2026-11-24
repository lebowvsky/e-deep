import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { SessionCookies } from '../../src/common/auth/session-cookie';
import { CLOCK, type Clock } from '../../src/common/time/clock';
import { configureApp } from '../../src/configure-app';
import { AccountsService } from '../../src/modules/accounts/accounts.service';
import { AdminMeController } from '../../src/modules/accounts/admin-me.controller';
import { MeController } from '../../src/modules/accounts/me.controller';
import { MeService } from '../../src/modules/accounts/me.service';
import {
  OnboardingService,
  type OnboardingState,
} from '../../src/modules/accounts/onboarding.service';
import { AdminAuthController } from '../../src/modules/auth/admin-auth.controller';
import { AuthController } from '../../src/modules/auth/auth.controller';
import { AuthenticationService } from '../../src/modules/auth/authentication.service';
import { RegistrationService } from '../../src/modules/auth/registration.service';
import {
  SessionService,
  type IssuedSession,
  type ResolvedSession,
} from '../../src/modules/auth/session.service';
import { CertificationLevel } from '../../src/modules/certification-levels/certification-level.entity';
import { CertificationLevelsController } from '../../src/modules/certification-levels/certification-levels.controller';
import { CertificationLevelsService } from '../../src/modules/certification-levels/certification-levels.service';
import { Consent } from '../../src/modules/consents/consent.entity';
import { ConsentsService } from '../../src/modules/consents/consents.service';
import { Diver } from '../../src/modules/divers/diver.entity';

// E2e harness of the authentication routes (auth lot 3): the real controllers, guards, DTOs,
// cookie writer, `MeService` and HTTP pipeline (`configureApp`); every service that touches the
// database is a fake (no database, docs/plans/auth.md §4 lot 3).

export const NOW = new Date('2026-11-24T10:00:00.000Z');
const DAY_MS = 86_400_000;

export const TOKEN = 'Tk1aW1pKUq1Gk0pXs0cH3xqzU8wQe6R2yQm4vN9bL7s';
export const OTHER_TOKEN = 'Zz9yX8wV7uT6sR5qP4oN3mL2kJ1iH0gF9eD8cB7aA6b';
export const NEW_TOKEN = 'Nw3wT0k3nR0t4t3dAbCdEfGhIjKlMnOpQrStUvWxYz0';

export const ACCOUNT_ID = '01900000-0000-7000-8000-0000000000c1';
export const DIVER_ID = '01900000-0000-7000-8000-000000000001';
export const SESSION_ID = '01900000-0000-7000-8000-0000000000e1';
export const STAFF_ACCOUNT_ID = '01900000-0000-7000-8000-0000000000c2';
export const LEVEL_ID = '01900000-0000-7000-8000-0000000000b2';
export const EMAIL = 'marine@example.test';
export const STAFF_EMAIL = 'support@example.test';

/** 180 days ahead: a persistent web session (`Max-Age` = 15 552 000). */
export const PERSISTENT: IssuedSession = {
  sessionId: SESSION_ID,
  token: NEW_TOKEN,
  expiresAt: new Date(NOW.getTime() + 180 * DAY_MS),
  persistent: true,
};
export const PERSISTENT_MAX_AGE = String(180 * 86_400);

/** A browser-session cookie: web without « Rester connecté », or admin. */
export const SHORT: IssuedSession = {
  sessionId: SESSION_ID,
  token: NEW_TOKEN,
  expiresAt: new Date(NOW.getTime() + DAY_MS),
  persistent: false,
};

export const DIVER_SESSION: ResolvedSession = {
  sessionId: SESSION_ID,
  accountId: ACCOUNT_ID,
  diverId: DIVER_ID,
  role: 'diver',
  audience: 'web',
  lastSeenAt: NOW,
  expiresAt: PERSISTENT.expiresAt,
};

export const STAFF_SESSION: ResolvedSession = {
  sessionId: SESSION_ID,
  accountId: STAFF_ACCOUNT_ID,
  diverId: null,
  role: 'support',
  audience: 'admin',
  lastSeenAt: NOW,
  expiresAt: SHORT.expiresAt,
};

export const DIVER_ACCOUNT = {
  id: ACCOUNT_ID,
  email: EMAIL,
  role: 'diver',
  diverId: DIVER_ID,
} as const;

export const STAFF_ACCOUNT = {
  id: STAFF_ACCOUNT_ID,
  email: STAFF_EMAIL,
  role: 'support',
  diverId: null,
} as const;

export const LEVEL = Object.assign(new CertificationLevel(), {
  id: LEVEL_ID,
  agency: 'FFESSM',
  code: 'N2',
  label: 'Niveau 2',
  rank: 2,
  isActive: true,
});

/** Right after sign-up: first name only (D36). */
export const INCOMPLETE: OnboardingState = {
  diver: Object.assign(new Diver(), {
    id: DIVER_ID,
    firstName: 'Marine',
    lastName: null,
    certificationLevelId: null,
    certificationLevel: null,
    avatarUrl: null,
  }),
  consent: null,
  status: 'profile-required',
};

/** After `/welcome`. */
export const COMPLETE: OnboardingState = {
  diver: Object.assign(new Diver(), {
    id: DIVER_ID,
    firstName: 'Marine',
    lastName: 'Rousseau',
    certificationLevelId: LEVEL_ID,
    certificationLevel: LEVEL,
    avatarUrl: null,
  }),
  consent: Object.assign(new Consent(), {
    policyVersion: '2026-11',
    grantedAt: new Date('2026-11-20T08:00:00.000Z'),
  }),
  status: 'complete',
};

/** Every faked service; reset before each test with `resetFakes`. */
export const fakes = {
  sessions: { resolve: jest.fn(), touch: jest.fn() },
  authentication: {
    loginDiver: jest.fn(),
    loginStaff: jest.fn(),
    signOut: jest.fn(),
    signOutEverywhere: jest.fn(),
  },
  registration: { register: jest.fn() },
  accounts: { identityOf: jest.fn(), changePassword: jest.fn(), deleteAccount: jest.fn() },
  onboarding: { stateOf: jest.fn(), complete: jest.fn() },
  consents: { grant: jest.fn() },
  levels: { findActive: jest.fn() },
};

/** Defaults: no live session, the diver's identity and a complete profile. */
export function resetFakes(): void {
  jest.resetAllMocks();
  fakes.sessions.resolve.mockResolvedValue(null);
  fakes.sessions.touch.mockResolvedValue(false);
  fakes.authentication.signOut.mockResolvedValue(undefined);
  fakes.authentication.signOutEverywhere.mockResolvedValue(undefined);
  fakes.accounts.identityOf.mockResolvedValue({ email: EMAIL, role: 'diver' });
  fakes.onboarding.stateOf.mockResolvedValue(COMPLETE);
}

export async function createAuthTestApp({
  secureCookies,
  trustProxy = 0,
}: {
  secureCookies: boolean;
  trustProxy?: number;
}): Promise<NestExpressApplication> {
  const clock: Clock = { now: () => NOW };
  const config = {
    get: (key: string): unknown => (key === 'SESSION_COOKIE_SECURE' ? secureCookies : undefined),
  };
  const moduleRef = await Test.createTestingModule({
    controllers: [
      AuthController,
      AdminAuthController,
      MeController,
      AdminMeController,
      CertificationLevelsController,
    ],
    providers: [
      SessionCookies,
      MeService,
      { provide: CLOCK, useValue: clock },
      { provide: ConfigService, useValue: config },
      { provide: SessionService, useValue: fakes.sessions },
      { provide: AuthenticationService, useValue: fakes.authentication },
      { provide: RegistrationService, useValue: fakes.registration },
      { provide: AccountsService, useValue: fakes.accounts },
      { provide: OnboardingService, useValue: fakes.onboarding },
      { provide: ConsentsService, useValue: fakes.consents },
      { provide: CertificationLevelsService, useValue: fakes.levels },
    ],
  }).compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app, { corsOrigins: ['http://localhost:5173'], trustProxy });
  await app.init();
  return app;
}

/** A `Set-Cookie` header: its name, value and attributes (lower-cased names). */
export interface SetCookie {
  readonly name: string;
  readonly value: string;
  readonly attributes: ReadonlyMap<string, string | true>;
}

export function setCookies(header: string | string[] | undefined): SetCookie[] {
  const headers = header === undefined ? [] : Array.isArray(header) ? header : [header];
  return headers.map((line) => {
    const [pair = '', ...attributes] = line.split(';').map((part) => part.trim());
    const separator = pair.indexOf('=');
    return {
      name: pair.slice(0, separator),
      value: pair.slice(separator + 1),
      attributes: new Map(
        attributes.map((attribute): [string, string | true] => {
          const equals = attribute.indexOf('=');
          return equals === -1
            ? [attribute.toLowerCase(), true]
            : [attribute.slice(0, equals).toLowerCase(), attribute.slice(equals + 1)];
        }),
      ),
    };
  });
}

/** The only `Set-Cookie` of a response (fails the test when there is not exactly one). */
export function singleSetCookie(header: string | string[] | undefined): SetCookie {
  const cookies = setCookies(header);
  expect(cookies).toHaveLength(1);
  const [cookie] = cookies;
  if (cookie === undefined) {
    throw new Error('No Set-Cookie');
  }
  return cookie;
}
