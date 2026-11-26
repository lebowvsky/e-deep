import { randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import { InvalidCredentialsError, TooManyAttemptsError } from '../../common/errors/domain-errors';
import type { Account } from '../accounts/account.entity';
import type { AuthEventsService } from './auth-events.service';
import { AuthenticationService } from './authentication.service';
import type { LoginThrottle, ThrottleDecision } from './login-throttle';
import type { PasswordCheck, PasswordHasher } from './password/password-hasher';
import type { IssuedSession, SessionService } from './session.service';
import { StaffTotp } from './totp/staff-totp';
import { hotp, totpStepAt } from './totp/totp';
import { TotpSecretCipher } from './totp/totp-secret-cipher';

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
const NOW = new Date('2026-11-27T10:00:10.000Z');
const STEP = totpStepAt(NOW);
const CIPHER = new TotpSecretCipher(randomBytes(32));
const TOTP_SECRET = randomBytes(20);
const STAFF = {
  id: 'account-staff',
  email: 'support@example.test',
  role: 'support',
  diverId: null,
  passwordHash: 'stored-staff-hash',
  totpSecret: CIPHER.encrypt(TOTP_SECRET, 'account-staff'),
  totpLastUsedStep: null,
} as Account;
/** The code the authenticator of STAFF shows `offset` steps from now. */
const codeAt = (offset = 0): string => hotp(TOTP_SECRET, STEP + offset);
const WRONG_CODE = codeAt() === '000000' ? '000001' : '000000';

function setup({
  accounts = [DIVER, STAFF],
  check = 'match',
  needsRehash = false,
  decision = { allowed: true },
  stepAccepted = true,
  cipher = CIPHER,
}: {
  accounts?: Account[];
  check?: PasswordCheck;
  needsRehash?: boolean;
  decision?: ThrottleDecision;
  /** Outcome of the conditional `UPDATE` of `totp_last_used_step` (false: a concurrent login won). */
  stepAccepted?: boolean;
  cipher?: TotpSecretCipher | null;
} = {}) {
  const acceptStep = jest.fn().mockResolvedValue({ affected: stepAccepted ? 1 : 0 });
  const stepUpdate = {
    update: jest.fn(),
    set: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    execute: acceptStep,
  };
  for (const chained of [
    stepUpdate.update,
    stepUpdate.set,
    stepUpdate.where,
    stepUpdate.andWhere,
  ]) {
    chained.mockReturnValue(stepUpdate);
  }
  const manager = {
    findOneBy: jest.fn((_entity: unknown, { email }: { email: string }) =>
      Promise.resolve(accounts.find((account) => account.email === email) ?? null),
    ),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    createQueryBuilder: () => stepUpdate,
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
  const sessions = {
    createIn: jest.fn().mockResolvedValue(ISSUED),
    revokeIn: jest.fn().mockResolvedValue(null),
    revoke: jest.fn().mockResolvedValue(null),
    revokeAllIn: jest.fn().mockResolvedValue(2),
  };
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
    new StaffTotp(cipher, { now: () => NOW }),
  );
  return { service, manager, hasher, throttle, sessions, authEvents, stepUpdate };
}

const web = (email: string, password = PASSWORD) => ({
  email,
  password,
  rememberMe: true,
  ip: '203.0.113.7',
});

const admin = (email: string, totpCode = codeAt()) => ({
  email,
  password: PASSWORD,
  totpCode,
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
    const secrets = [DIVER.id, DIVER.email, STAFF.id, STAFF.email, PASSWORD, 'nobody', codeAt()];
    for (const secret of [...secrets, STAFF.totpSecret ?? 'unset']) {
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

    await expect(service.loginStaff(admin(DIVER.email))).rejects.toThrow(InvalidCredentialsError);
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

    await service.loginStaff(admin(STAFF.email));

    expect(sessions.createIn).toHaveBeenCalledWith(expect.anything(), STAFF.id, 'admin', {
      rememberMe: false,
    });
  });

  describe('staff TOTP (D42)', () => {
    it('accepts the step of the code with a conditional UPDATE before the session', async () => {
      const { service, stepUpdate, sessions } = setup();

      await service.loginStaff(admin(STAFF.email, codeAt(-1)));

      expect(stepUpdate.set).toHaveBeenCalledWith({ totpLastUsedStep: STEP - 1 });
      expect(stepUpdate.where).toHaveBeenCalledWith('id = :id', { id: STAFF.id });
      expect(stepUpdate.andWhere).toHaveBeenCalledWith(
        '(totp_last_used_step IS NULL OR totp_last_used_step < :step)',
        { step: STEP - 1 },
      );
      // Bound to the secret the code was checked against (no session after a concurrent reset).
      expect(stepUpdate.andWhere).toHaveBeenCalledWith('totp_secret = :secret', {
        secret: STAFF.totpSecret,
      });
      expect(stepUpdate.execute.mock.invocationCallOrder[0]).toBeLessThan(
        sessions.createIn.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it.each([
      ['a wrong code', setup, WRONG_CODE],
      ['a code two steps old', setup, codeAt(-2)],
      [
        'a code of the step already accepted',
        () => setup({ accounts: [{ ...STAFF, totpLastUsedStep: STEP }] }),
        codeAt(),
      ],
      [
        'an older code still inside the window',
        () => setup({ accounts: [{ ...STAFF, totpLastUsedStep: STEP }] }),
        codeAt(-1),
      ],
      [
        'a code accepted meanwhile by a concurrent login (UPDATE affects no row)',
        () => setup({ stepAccepted: false }),
        codeAt(),
      ],
      [
        'a staff account without a secret',
        () => setup({ accounts: [{ ...STAFF, totpSecret: null }] }),
        codeAt(),
      ],
      ['any code without TOTP_ENCRYPTION_KEY', () => setup({ cipher: null }), codeAt()],
    ])('answers %s like a wrong password', async (_case, arrange, code) => {
      const { service, sessions, authEvents } = arrange();

      await expect(service.loginStaff(admin(STAFF.email, code))).rejects.toThrow(
        InvalidCredentialsError,
      );
      expect(authEvents.record).toHaveBeenCalledWith(STAFF.id, 'login_failed');
      expect(sessions.createIn).not.toHaveBeenCalled();
    });

    it('never checks the code after a wrong password: no step is consumed', async () => {
      const { service, stepUpdate } = setup({ check: 'mismatch' });

      await expect(service.loginStaff(admin(STAFF.email))).rejects.toThrow(InvalidCredentialsError);
      expect(stepUpdate.execute).not.toHaveBeenCalled();
    });

    it('counts a refused code in the throttle, like any attempt', async () => {
      const { service, throttle } = setup();

      await expect(service.loginStaff(admin(STAFF.email, WRONG_CODE))).rejects.toThrow(
        InvalidCredentialsError,
      );
      expect(throttle.consume).toHaveBeenCalledWith({ ip: '203.0.113.7', email: STAFF.email });
    });

    it('never asks a TOTP code on the web', async () => {
      const { service, stepUpdate } = setup();

      await service.loginDiver(web(DIVER.email));

      expect(stepUpdate.execute).not.toHaveBeenCalled();
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

  describe('session rotation', () => {
    it('revokes the presented cookies of the audience with the new session', async () => {
      const { service, sessions } = setup();

      await service.loginDiver({ ...web(DIVER.email), replacedTokens: ['old-1', 'old-2'] });

      expect(sessions.revokeIn).toHaveBeenCalledTimes(2);
      expect(sessions.revokeIn).toHaveBeenCalledWith(expect.anything(), 'old-1', 'web');
      expect(sessions.revokeIn).toHaveBeenCalledWith(expect.anything(), 'old-2', 'web');
    });

    it('revokes an admin cookie on an admin login', async () => {
      const { service, sessions } = setup();

      await service.loginStaff({ ...admin(STAFF.email), replacedTokens: ['old-admin'] });

      expect(sessions.revokeIn).toHaveBeenCalledWith(expect.anything(), 'old-admin', 'admin');
    });

    it('keeps the presented session when the login fails', async () => {
      const { service, sessions } = setup({ check: 'mismatch' });

      await expect(
        service.loginDiver({ ...web(DIVER.email), replacedTokens: ['old-1'] }),
      ).rejects.toThrow(InvalidCredentialsError);
      expect(sessions.revokeIn).not.toHaveBeenCalled();
    });
  });

  describe('signOut', () => {
    it('revokes each token and traces logout for a deleted session only', async () => {
      const { service, sessions, authEvents } = setup();
      sessions.revoke.mockResolvedValueOnce(DIVER.id).mockResolvedValueOnce(null);

      await service.signOut(['live', 'unknown'], 'web');

      expect(sessions.revoke).toHaveBeenCalledWith('live', 'web');
      expect(sessions.revoke).toHaveBeenCalledWith('unknown', 'web');
      expect(authEvents.record).toHaveBeenCalledTimes(1);
      expect(authEvents.record).toHaveBeenCalledWith(DIVER.id, 'logout');
    });

    it('does nothing without a token', async () => {
      const { service, sessions, authEvents } = setup();

      await service.signOut([], 'admin');

      expect(sessions.revoke).not.toHaveBeenCalled();
      expect(authEvents.record).not.toHaveBeenCalled();
    });
  });

  it('signOutEverywhere revokes every session and traces sessions_revoked', async () => {
    const { service, sessions, authEvents } = setup();

    await service.signOutEverywhere(DIVER.id);

    expect(sessions.revokeAllIn).toHaveBeenCalledWith(expect.anything(), DIVER.id);
    expect(authEvents.recordIn).toHaveBeenCalledWith(
      expect.anything(),
      DIVER.id,
      'sessions_revoked',
    );
  });
});
