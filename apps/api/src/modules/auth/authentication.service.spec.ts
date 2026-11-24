import { Logger } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import { InvalidCredentialsError, TooManyAttemptsError } from '../../common/errors/domain-errors';
import type { Account } from '../accounts/account.entity';
import type { AuthEventsService } from './auth-events.service';
import { AuthenticationService } from './authentication.service';
import type { LoginThrottle, ThrottleDecision } from './login-throttle';
import type { PasswordCheck, PasswordHasher } from './password/password-hasher';
import type { IssuedSession, SessionService } from './session.service';

const PASSWORD = 'a long enough passphrase';
const ISSUED: IssuedSession = {
  sessionId: 'session-1',
  token: 'token',
  expiresAt: new Date('2027-05-23T10:00:00.000Z'),
  persistent: true,
};
const DIVER = {
  id: 'account-diver',
  email: 'marine@example.test',
  role: 'diver',
  diverId: 'diver-1',
  passwordHash: 'stored-diver-hash',
} as Account;
const STAFF = {
  id: 'account-staff',
  email: 'support@example.test',
  role: 'support',
  diverId: null,
  passwordHash: 'stored-staff-hash',
} as Account;

function setup({
  accounts = [DIVER, STAFF],
  check = 'match',
  needsRehash = false,
  decision = { allowed: true },
}: {
  accounts?: Account[];
  check?: PasswordCheck;
  needsRehash?: boolean;
  decision?: ThrottleDecision;
} = {}) {
  const manager = {
    findOneBy: jest.fn((_entity: unknown, { email }: { email: string }) =>
      Promise.resolve(accounts.find((account) => account.email === email) ?? null),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const dataSource = {
    manager,
    transaction: (run: (m: EntityManager) => Promise<unknown>) =>
      run(manager as unknown as EntityManager),
  };
  const hasher = {
    check: jest.fn().mockResolvedValue(check),
    verifyDummy: jest.fn().mockResolvedValue(false),
    needsRehash: jest.fn().mockReturnValue(needsRehash),
    hash: jest.fn().mockResolvedValue('rehashed'),
  };
  const throttle = { consume: jest.fn().mockReturnValue(decision) };
  const sessions = { createIn: jest.fn().mockResolvedValue(ISSUED) };
  const authEvents = {
    record: jest.fn().mockResolvedValue(undefined),
    recordIn: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AuthenticationService(
    dataSource as unknown as DataSource,
    hasher as unknown as PasswordHasher,
    throttle as unknown as LoginThrottle,
    sessions as unknown as SessionService,
    authEvents as unknown as AuthEventsService,
  );
  return { service, manager, hasher, throttle, sessions, authEvents };
}

const web = (email: string, password = PASSWORD) => ({
  email,
  password,
  rememberMe: true,
  ip: '203.0.113.7',
});

describe('AuthenticationService', () => {
  let logged: jest.SpyInstance[];

  beforeEach(() => {
    logged = (['log', 'warn', 'error'] as const).map((level) =>
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined),
    );
  });

  afterEach(() => {
    // D40: an event name and a reason code only, never an id, an email nor a password.
    const messages = logged.flatMap((spy) => spy.mock.calls.flat().map(String));
    for (const secret of [DIVER.id, DIVER.email, STAFF.id, STAFF.email, PASSWORD, 'nobody']) {
      expect(messages.join('\n')).not.toContain(secret);
    }
    jest.restoreAllMocks();
  });

  it('signs a diver in on the web with a new session and the trail', async () => {
    const { service, sessions, authEvents, hasher } = setup();

    const result = await service.loginDiver(web('  Marine@Example.test '));

    expect(result).toStrictEqual({
      account: { id: DIVER.id, email: DIVER.email, role: 'diver', diverId: 'diver-1' },
      session: ISSUED,
    });
    expect(result.account).not.toHaveProperty('passwordHash');
    expect(hasher.check).toHaveBeenCalledWith(PASSWORD, 'stored-diver-hash');
    expect(sessions.createIn).toHaveBeenCalledWith(expect.anything(), DIVER.id, 'web', {
      rememberMe: true,
    });
    expect(authEvents.recordIn).toHaveBeenCalledWith(
      expect.anything(),
      DIVER.id,
      'login_succeeded',
    );
  });

  it('verifies the dummy hash for an unknown email, with the same error', async () => {
    const { service, hasher, authEvents, sessions } = setup();

    await expect(service.loginDiver(web('nobody@example.test'))).rejects.toThrow(
      InvalidCredentialsError,
    );
    expect(hasher.verifyDummy).toHaveBeenCalledWith(PASSWORD);
    expect(hasher.check).not.toHaveBeenCalled();
    expect(authEvents.record).toHaveBeenCalledWith(null, 'login_failed');
    expect(sessions.createIn).not.toHaveBeenCalled();
  });

  it('answers a wrong password like an unknown email', async () => {
    const { service, authEvents } = setup({ check: 'mismatch' });

    await expect(service.loginDiver(web(DIVER.email))).rejects.toThrow(InvalidCredentialsError);
    expect(authEvents.record).toHaveBeenCalledWith(DIVER.id, 'login_failed');
  });

  it('refuses a staff account on the web, after a real verification', async () => {
    const { service, hasher, sessions } = setup();

    await expect(service.loginDiver(web(STAFF.email))).rejects.toThrow(InvalidCredentialsError);
    expect(hasher.check).toHaveBeenCalledWith(PASSWORD, 'stored-staff-hash');
    expect(sessions.createIn).not.toHaveBeenCalled();
  });

  it('refuses a diver account on the admin, after a real verification', async () => {
    const { service, sessions, hasher } = setup();

    await expect(
      service.loginStaff({ email: DIVER.email, password: PASSWORD, ip: '203.0.113.7' }),
    ).rejects.toThrow(InvalidCredentialsError);
    expect(hasher.check).toHaveBeenCalledWith(PASSWORD, 'stored-diver-hash');
    expect(sessions.createIn).not.toHaveBeenCalled();
  });

  it('answers a malformed stored hash like a wrong password, not with a 500', async () => {
    const { service, authEvents, sessions } = setup({ check: 'malformed-hash' });

    await expect(service.loginDiver(web(DIVER.email))).rejects.toThrow(InvalidCredentialsError);
    expect(authEvents.record).toHaveBeenCalledWith(DIVER.id, 'login_failed');
    expect(sessions.createIn).not.toHaveBeenCalled();
  });

  it('signs staff in on the admin with a short session', async () => {
    const { service, sessions } = setup();

    await service.loginStaff({ email: STAFF.email, password: PASSWORD, ip: '203.0.113.7' });

    expect(sessions.createIn).toHaveBeenCalledWith(expect.anything(), STAFF.id, 'admin', {
      rememberMe: false,
    });
  });

  it('rehashes the password when the parameters changed', async () => {
    const { service, manager, hasher } = setup({ needsRehash: true });

    await service.loginDiver(web(DIVER.email));

    expect(hasher.hash).toHaveBeenCalledWith(PASSWORD);
    expect(manager.update).toHaveBeenCalledWith(
      expect.anything(),
      { id: DIVER.id },
      { passwordHash: 'rehashed' },
    );
  });

  it('refuses a throttled attempt before any lookup, with its delay', async () => {
    const { service, manager, hasher, authEvents, throttle } = setup({
      decision: { allowed: false, retryAfterSeconds: 42, justThrottled: true },
    });

    await expect(service.loginDiver(web(DIVER.email))).rejects.toMatchObject(
      new TooManyAttemptsError(42),
    );
    expect(throttle.consume).toHaveBeenCalledWith({ ip: '203.0.113.7', email: DIVER.email });
    expect(manager.findOneBy).not.toHaveBeenCalled();
    expect(hasher.check).not.toHaveBeenCalled();
    expect(authEvents.record).toHaveBeenCalledWith(null, 'login_throttled');
  });

  it('traces login_throttled only when a key just switched to throttled', async () => {
    const { service, authEvents } = setup({
      decision: { allowed: false, retryAfterSeconds: 42, justThrottled: false },
    });

    await expect(service.loginDiver(web(DIVER.email))).rejects.toThrow(TooManyAttemptsError);
    expect(authEvents.record).not.toHaveBeenCalled();
  });
});
