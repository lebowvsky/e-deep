import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import {
  EmailTakenError,
  InactiveCertificationLevelError,
  InvalidCredentialsError,
  OnboardingCompleteError,
  TooManyAttemptsError,
} from '../../src/common/errors/domain-errors';
import type { Clock } from '../../src/common/time/clock';
import { Account } from '../../src/modules/accounts/account.entity';
import { AccountsService } from '../../src/modules/accounts/accounts.service';
import { OnboardingService } from '../../src/modules/accounts/onboarding.service';
import { AuthEvent } from '../../src/modules/auth/auth-event.entity';
import { AuthEventsService } from '../../src/modules/auth/auth-events.service';
import { AuthenticationService } from '../../src/modules/auth/authentication.service';
import { LoginThrottle } from '../../src/modules/auth/login-throttle';
import { PasswordHasher } from '../../src/modules/auth/password/password-hasher';
import { PasswordPolicy } from '../../src/modules/auth/password/password-policy';
import {
  RegistrationService,
  type RegistrationResult,
} from '../../src/modules/auth/registration.service';
import { Session } from '../../src/modules/auth/session.entity';
import { SessionService } from '../../src/modules/auth/session.service';
import { Consent } from '../../src/modules/consents/consent.entity';
import { ConsentsService } from '../../src/modules/consents/consents.service';
import { Diver } from '../../src/modules/divers/diver.entity';
import { DiversService } from '../../src/modules/divers/divers.service';
import { Fixtures } from './support/fixtures';
import { createTestDataSource, resetDatabase } from './support/test-database';

/** Cheap Argon2id parameters: these tests check transactions, not the cost. */
const FAST = { memoryKib: 64, passes: 1, parallelism: 1 };
const PASSWORD = 'coral reef at dawn, twice';
const NEW_PASSWORD = 'night dive under the full moon';
const IP = '203.0.113.7';

describe('authentication and account services', () => {
  let dataSource: DataSource;
  let fixtures: Fixtures;
  let now: Date;
  let sessions: SessionService;
  let consents: ConsentsService;
  let registration: RegistrationService;
  let authentication: AuthenticationService;
  let onboarding: OnboardingService;
  let accounts: AccountsService;
  let hasher: PasswordHasher;

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    fixtures = new Fixtures(dataSource);
    hasher = await PasswordHasher.create(FAST);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  /** D40: every log is an event name, optionally with a reason code; nothing else. */
  const LOG_LINE = /^[a-z_]+( reason=[a-z-]+)?$/;
  let logged: jest.SpyInstance[];

  beforeEach(async () => {
    logged = (['log', 'warn', 'error'] as const).map((level) =>
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined),
    );
    await resetDatabase(dataSource);
    now = new Date();
    const clock: Clock = { now: () => now };
    const policy = new PasswordPolicy(new Set(['iloveyouforever123']));
    const authEvents = new AuthEventsService(dataSource);
    const divers = new DiversService(dataSource);
    // A fresh throttle per test, generous enough never to interfere.
    const throttle = new LoginThrottle({
      rules: {
        ip: { capacity: 1_000, refillIntervalMs: 1_000 },
        email: { capacity: 1_000, refillIntervalMs: 1_000 },
      },
    });
    sessions = new SessionService(dataSource, clock);
    consents = new ConsentsService(dataSource, authEvents);
    registration = new RegistrationService(
      dataSource,
      { registrationEnabled: true },
      divers,
      hasher,
      policy,
      throttle,
      sessions,
      authEvents,
    );
    authentication = new AuthenticationService(dataSource, hasher, throttle, sessions, authEvents);
    onboarding = new OnboardingService(dataSource, divers, consents);
    accounts = new AccountsService(
      dataSource,
      hasher,
      policy,
      throttle,
      sessions,
      authEvents,
      divers,
    );
  });

  afterEach(() => {
    // Covers RegistrationService, AuthenticationService and AccountsService: no id, email,
    // password nor token can fit the pattern.
    const messages = logged.flatMap((spy) => spy.mock.calls.flat().map(String));
    for (const message of messages) {
      expect(message).toMatch(LOG_LINE);
    }
    jest.restoreAllMocks();
  });

  const register = (email = 'Lou@Example.test'): Promise<RegistrationResult> =>
    registration.register({ firstName: ' Lou ', email, password: PASSWORD, ip: IP });

  async function eventTypes(): Promise<string[]> {
    const events = await dataSource.manager.find(AuthEvent, { order: { occurredAt: 'ASC' } });
    return events.map((event) => event.type);
  }

  describe('registration', () => {
    it('creates the incomplete diver, the account, a long web session and the trail', async () => {
      const { account, diver, session } = await register();

      expect(diver).toMatchObject({ firstName: 'Lou', lastName: null, certificationLevelId: null });
      expect(account).toMatchObject({
        diverId: diver.id,
        email: 'lou@example.test',
        role: 'diver',
      });
      expect(account).not.toHaveProperty('passwordHash');
      const stored = await dataSource.manager.findOneByOrFail(Account, { id: account.id });
      expect(stored.passwordHash.startsWith('$argon2id$v=19$')).toBe(true);
      expect(session.persistent).toBe(true);
      await expect(sessions.resolve(session.token, 'web')).resolves.toMatchObject({
        accountId: account.id,
        diverId: diver.id,
      });
      expect(await eventTypes()).toEqual(['account_created']);
    });

    it('is atomic: nothing is written when the session insert fails', async () => {
      jest.spyOn(sessions, 'createIn').mockRejectedValueOnce(new Error('session insert failed'));

      await expect(register()).rejects.toThrow('session insert failed');

      expect(await dataSource.manager.count(Diver)).toBe(0);
      expect(await dataSource.manager.count(Account)).toBe(0);
      expect(await dataSource.manager.count(Session)).toBe(0);
      expect(await dataSource.manager.count(AuthEvent)).toBe(0);
    });

    it('writes nothing when the policy refuses the password', async () => {
      await expect(
        registration.register({
          firstName: 'Lou',
          email: 'lou@example.test',
          password: 'ILoveYouForever123',
          ip: IP,
        }),
      ).rejects.toMatchObject({ fieldErrors: { password: ['compromised'] } });

      for (const entity of [Diver, Account, Session, AuthEvent]) {
        expect(await dataSource.manager.count(entity)).toBe(0);
      }
    });

    it('answers email-taken for a normalised duplicate, rolling back its diver', async () => {
      await register('lou@example.test');

      await expect(register('  LOU@example.TEST')).rejects.toThrow(EmailTakenError);

      expect(await dataSource.manager.count(Diver)).toBe(1);
      expect(await dataSource.manager.count(Account)).toBe(1);
    });
  });

  describe('login', () => {
    it('opens a new session on every login and refuses a wrong password', async () => {
      const { session: first } = await register();

      const { session: second } = await authentication.loginDiver({
        email: 'lou@example.test',
        password: PASSWORD,
        rememberMe: false,
        ip: IP,
      });

      expect(second.token).not.toBe(first.token);
      expect(second.persistent).toBe(false);
      expect(await dataSource.manager.count(Session)).toBe(2);
      await expect(
        authentication.loginDiver({
          email: 'lou@example.test',
          password: NEW_PASSWORD,
          rememberMe: true,
          ip: IP,
        }),
      ).rejects.toThrow(InvalidCredentialsError);
      expect(await eventTypes()).toEqual(['account_created', 'login_succeeded', 'login_failed']);
    });

    it('stores a rehash when the parameters changed', async () => {
      const { account } = await register();
      const stronger = await PasswordHasher.create({ ...FAST, passes: 2 });
      const throttle = new LoginThrottle();
      const service = new AuthenticationService(
        dataSource,
        stronger,
        throttle,
        sessions,
        new AuthEventsService(dataSource),
      );

      await service.loginDiver({
        email: account.email,
        password: PASSWORD,
        rememberMe: true,
        ip: IP,
      });

      const stored = await dataSource.manager.findOneByOrFail(Account, { id: account.id });
      expect(stored.passwordHash).toContain('$m=64,t=2,p=1$');
      await expect(stronger.verify(PASSWORD, stored.passwordHash)).resolves.toBe(true);
    });
  });

  describe('sessions', () => {
    it('revokeAll deletes every session of the account but the kept one', async () => {
      const { account, session: kept } = await register();
      await sessions.create(account.id, 'web', { rememberMe: true });
      await sessions.create(account.id, 'web', { rememberMe: false });
      const other = await register('other@example.test');

      await expect(sessions.revokeAll(account.id, kept.sessionId)).resolves.toBe(2);

      expect(await dataSource.manager.countBy(Session, { accountId: account.id })).toBe(1);
      await expect(sessions.resolve(kept.token, 'web')).resolves.not.toBeNull();
      await expect(sessions.resolve(other.session.token, 'web')).resolves.not.toBeNull();
      await expect(sessions.revokeAll(account.id)).resolves.toBe(1);
    });

    it('revoke is idempotent and limited to its audience', async () => {
      const { session } = await register();

      await sessions.revoke(session.token, 'admin');
      await expect(sessions.resolve(session.token, 'web')).resolves.not.toBeNull();

      await sessions.revoke(session.token, 'web');
      await sessions.revoke(session.token, 'web');

      await expect(sessions.resolve(session.token, 'web')).resolves.toBeNull();
    });

    it('touch writes last_seen_at once the interval has passed', async () => {
      const { session } = await register();
      now = new Date(now.getTime() + 3_600_000);

      const resolved = await sessions.resolve(session.token, 'web');
      await expect(sessions.touch(resolved!)).resolves.toBe(true);
      await expect(sessions.touch(resolved!)).resolves.toBe(false);

      const stored = await dataSource.manager.findOneByOrFail(Session, { id: session.sessionId });
      expect(stored.lastSeenAt).toEqual(now);
    });
  });

  describe('onboarding', () => {
    it('writes the level, the last name and the consent: complete', async () => {
      const { account, diver } = await register();

      const state = await onboarding.complete({
        accountId: account.id,
        diverId: diver.id,
        lastName: '  Petit ',
        certificationLevelId: await fixtures.levelId('N2'),
        policyVersion: '2026-11',
      });

      expect(state.status).toBe('complete');
      expect(state.diver).toMatchObject({ lastName: 'Petit' });
      expect(state.diver.certificationLevel?.code).toBe('N2');
      expect(state.consent).toMatchObject({ policyVersion: '2026-11', withdrawnAt: null });
      expect(await eventTypes()).toEqual(['account_created', 'consent_granted']);
    });

    it('is atomic: the level is not written when the consent insert fails', async () => {
      const { account, diver } = await register();
      jest.spyOn(consents, 'grantIn').mockRejectedValueOnce(new Error('consent insert failed'));

      await expect(
        onboarding.complete({
          accountId: account.id,
          diverId: diver.id,
          lastName: 'Petit',
          certificationLevelId: await fixtures.levelId('N2'),
          policyVersion: '2026-11',
        }),
      ).rejects.toThrow('consent insert failed');

      const stored = await dataSource.manager.findOneByOrFail(Diver, { id: diver.id });
      expect(stored).toMatchObject({ lastName: null, certificationLevelId: null });
      expect(await dataSource.manager.count(Consent)).toBe(0);
      expect((await onboarding.stateOf(diver.id)).status).toBe('profile-required');
    });

    it('refuses a second onboarding and an inactive level', async () => {
      const { account, diver } = await register();
      const input = {
        accountId: account.id,
        diverId: diver.id,
        lastName: null,
        certificationLevelId: await fixtures.levelId('N1'),
        policyVersion: '2026-11',
      };
      const retired = await fixtures.addLevel({ isActive: false });

      await expect(
        onboarding.complete({ ...input, certificationLevelId: retired.id }),
      ).rejects.toThrow(InactiveCertificationLevelError);
      await onboarding.complete(input);
      await expect(onboarding.complete(input)).rejects.toThrow(OnboardingCompleteError);

      expect(await dataSource.manager.count(Consent)).toBe(1);
    });

    it('lets a diver with a level but no consent onboard again (profile-required, D38)', async () => {
      const diver = await fixtures.diver({ lastName: 'Martin' });
      const account = await fixtures.account(diver.id);
      expect((await onboarding.stateOf(diver.id)).status).toBe('profile-required');

      const state = await onboarding.complete({
        accountId: account.id,
        diverId: diver.id,
        lastName: null,
        certificationLevelId: await fixtures.levelId('N3'),
        policyVersion: '2026-11',
      });

      expect(state.status).toBe('complete');
      expect(state.diver).toMatchObject({ lastName: null });
      expect(state.diver.certificationLevel?.code).toBe('N3');
      expect(await dataSource.manager.count(Consent)).toBe(1);
    });

    it('refuses onboarding to a consent-required diver: re-consent goes through /me/consents', async () => {
      const diver = await fixtures.diver();
      const account = await fixtures.account(diver.id);
      await fixtures.consent(diver.id, { policyVersion: '2025-06' });

      await expect(
        onboarding.complete({
          accountId: account.id,
          diverId: diver.id,
          lastName: null,
          certificationLevelId: await fixtures.levelId('N2'),
          policyVersion: '2026-11',
        }),
      ).rejects.toThrow(OnboardingCompleteError);
      expect((await onboarding.stateOf(diver.id)).status).toBe('consent-required');
    });

    it('asks for a new consent when the live one is outdated, then keeps the history', async () => {
      const diver = await fixtures.diver();
      const account = await fixtures.account(diver.id);
      await fixtures.consent(diver.id, { policyVersion: '2025-06' });

      expect((await onboarding.stateOf(diver.id)).status).toBe('consent-required');
      await consents.grant({
        accountId: account.id,
        diverId: diver.id,
        purpose: 'health_data_processing',
        policyVersion: '2026-11',
      });

      expect((await onboarding.stateOf(diver.id)).status).toBe('complete');
      const history = await dataSource.manager.find(Consent, { order: { grantedAt: 'ASC' } });
      expect(
        history.map((consent) => [consent.policyVersion, consent.withdrawnAt === null]),
      ).toEqual([
        ['2025-06', false],
        ['2026-11', true],
      ]);
    });
  });

  describe('account', () => {
    it('changes the password: other sessions revoked, the caller rotated', async () => {
      const { account, session: current } = await register();
      const other = await sessions.create(account.id, 'web', { rememberMe: true });
      const before = await dataSource.manager.findOneByOrFail(Account, { id: account.id });

      const rotated = await accounts.changePassword(
        { accountId: account.id, sessionId: current.sessionId, ip: IP },
        { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      );

      expect(rotated.sessionId).toBe(current.sessionId);
      expect(rotated.expiresAt).toEqual(current.expiresAt);
      expect(rotated.persistent).toBe(true);
      await expect(sessions.resolve(current.token, 'web')).resolves.toBeNull();
      await expect(sessions.resolve(other.token, 'web')).resolves.toBeNull();
      await expect(sessions.resolve(rotated.token, 'web')).resolves.not.toBeNull();
      const stored = await dataSource.manager.findOneByOrFail(Account, { id: account.id });
      await expect(hasher.verify(NEW_PASSWORD, stored.passwordHash)).resolves.toBe(true);
      expect(stored.passwordChangedAt.getTime()).toBeGreaterThanOrEqual(
        before.passwordChangedAt.getTime(),
      );
      expect(await eventTypes()).toEqual(['account_created', 'password_changed']);
    });

    it('keeps a short session short when rotating it', async () => {
      const { account } = await register();
      const short = await authentication.loginDiver({
        email: account.email,
        password: PASSWORD,
        rememberMe: false,
        ip: IP,
      });

      const rotated = await accounts.changePassword(
        { accountId: account.id, sessionId: short.session.sessionId, ip: IP },
        { currentPassword: PASSWORD, newPassword: NEW_PASSWORD },
      );

      expect(rotated.persistent).toBe(false);
      expect(rotated.expiresAt).toEqual(short.session.expiresAt);
    });

    it('answers 429 once the password checks of the account are exhausted', async () => {
      const { account, session } = await register();
      const tight = new AccountsService(
        dataSource,
        hasher,
        new PasswordPolicy(new Set()),
        new LoginThrottle({
          rules: {
            ip: { capacity: 100, refillIntervalMs: 60_000 },
            email: { capacity: 1, refillIntervalMs: 60_000 },
          },
        }),
        sessions,
        new AuthEventsService(dataSource),
        new DiversService(dataSource),
      );
      const caller = { accountId: account.id, sessionId: session.sessionId, ip: IP };

      await expect(tight.deleteAccount(caller, NEW_PASSWORD)).rejects.toThrow(
        InvalidCredentialsError,
      );
      await expect(tight.deleteAccount(caller, PASSWORD)).rejects.toThrow(TooManyAttemptsError);

      expect(await dataSource.manager.existsBy(Account, { id: account.id })).toBe(true);
    });

    it('refuses a wrong current password and a new password containing the name', async () => {
      const { account, session } = await register();
      const caller = { accountId: account.id, sessionId: session.sessionId, ip: IP };

      await expect(
        accounts.changePassword(caller, {
          currentPassword: NEW_PASSWORD,
          newPassword: NEW_PASSWORD,
        }),
      ).rejects.toThrow(InvalidCredentialsError);
      await expect(
        accounts.changePassword(caller, {
          currentPassword: PASSWORD,
          newPassword: 'lou dives every sunday',
        }),
      ).rejects.toMatchObject({ fieldErrors: { newPassword: ['contains-identity'] } });

      await expect(sessions.resolve(session.token, 'web')).resolves.not.toBeNull();
      // The wrong current password is a failed authentication of the account.
      expect(await eventTypes()).toEqual(['account_created', 'login_failed']);
    });

    it('deletes the account, its diver and sessions; the trail keeps an anonymous event', async () => {
      const { account, diver, session } = await register();
      await sessions.create(account.id, 'web', { rememberMe: false });
      const other = await register('other@example.test');
      const caller = { accountId: account.id, sessionId: session.sessionId, ip: IP };

      await expect(accounts.deleteAccount(caller, NEW_PASSWORD)).rejects.toThrow(
        InvalidCredentialsError,
      );
      await accounts.deleteAccount(caller, PASSWORD);

      expect(await dataSource.manager.existsBy(Diver, { id: diver.id })).toBe(false);
      expect(await dataSource.manager.existsBy(Account, { id: account.id })).toBe(false);
      expect(await dataSource.manager.countBy(Session, { accountId: account.id })).toBe(0);
      await expect(sessions.resolve(session.token, 'web')).resolves.toBeNull();
      await expect(sessions.resolve(other.session.token, 'web')).resolves.not.toBeNull();
      const events = await dataSource.manager.find(AuthEvent, { order: { occurredAt: 'ASC' } });
      expect(events.map((event) => [event.type, event.accountId])).toEqual([
        ['account_created', other.account.id],
        ['account_deleted', null],
      ]);
    });
  });
});
