// First: the environment of `AppModule` (see the file).
import { restoreEnvironment } from './support/app-environment';
import type { AdminMeResponse } from '@e-deep/shared';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request, { type Response } from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { CLOCK, type Clock } from '../../src/common/time/clock';
import { configureApp } from '../../src/configure-app';
import { AccountProvisioningService } from '../../src/modules/accounts/account-provisioning.service';
import { Account } from '../../src/modules/accounts/account.entity';
import { AuthEvent } from '../../src/modules/auth/auth-event.entity';
import { LOGIN_THROTTLE_RULES, LoginThrottle } from '../../src/modules/auth/login-throttle';
import { PasswordHasher } from '../../src/modules/auth/password/password-hasher';
import { Session } from '../../src/modules/auth/session.entity';
import { StaffTotp } from '../../src/modules/auth/totp/staff-totp';
import { totpStepAt } from '../../src/modules/auth/totp/totp';
import { authenticatorCode } from '../support/authenticator';
import { resetDatabase } from './support/test-database';

// End-to-end staff sign-in (D42, lot 7b): `POST /api/admin/auth/login` through the whole
// `AppModule` on the `_test` database, with real staff accounts enrolled by the provisioning
// service (the code path of `account:create-staff`) and codes computed like an authenticator app
// from the printed URI. The wall clock is injected (`CLOCK`): TOTP steps and session expiries
// follow it. The per-IP throttle is widened so that the suite never hits it; the per-email one is
// the real one.

const PASSWORD = 'harbour signal 2031 slowly';
const MINUTE_MS = 60_000;
const STEP_MS = 30_000;
/** 10 s into a step: a code of the current step stays valid for this whole step. */
const START = new Date('2026-11-27T10:00:10.000Z');
const INVALID_CREDENTIALS = { statusCode: 401, code: 'invalid-credentials' };

describe('POST /api/admin/auth/login with TOTP (e2e, database)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let now = START;
  let staffCount = 0;
  const clock: Clock = { now: () => now };

  const server = () => request(app.getHttpServer());
  const advance = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .overrideProvider(LoginThrottle)
      .useValue(
        new LoginThrottle({
          rules: { ...LOGIN_THROTTLE_RULES, ip: { capacity: 1_000, refillIntervalMs: 1_000 } },
        }),
      )
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
    configureApp(app, { trustProxy: 0 });
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
    restoreEnvironment();
  });

  beforeEach(async () => {
    now = START;
    await resetDatabase(dataSource);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** A new staff account (its own email: its own throttle bucket), and its enrolment URI. */
  async function enrolStaff(role: 'support' | 'admin' = 'support') {
    staffCount += 1;
    const email = `staff-${staffCount}@example.test`;
    const { otpauthUri } = await app
      .get(AccountProvisioningService)
      .createStaffAccount({ role, email, password: PASSWORD });
    const account = await dataSource.manager.findOneByOrFail(Account, { email });
    return {
      email,
      account,
      code: (offsetSteps = 0) => authenticatorCode(otpauthUri, now, offsetSteps),
    };
  }

  function login(email: string, totpCode: string, password = PASSWORD) {
    return server()
      .post('/api/admin/auth/login')
      .set('Sec-Fetch-Site', 'same-origin')
      .send({ email, password, totpCode });
  }

  function adminCookieOf(response: Response): string {
    const header: unknown = response.headers['set-cookie'];
    const lines = Array.isArray(header) ? header.filter((line) => typeof line === 'string') : [];
    const cookie = lines.find((line) => line.startsWith('edeep_admin_sid='));
    if (cookie === undefined) {
      throw new Error('No admin cookie');
    }
    return cookie.split(';')[0] ?? '';
  }

  async function lastUsedStepOf(accountId: string): Promise<number | null> {
    return (await dataSource.manager.findOneByOrFail(Account, { id: accountId })).totpLastUsedStep;
  }

  async function eventTypesOf(accountId: string): Promise<string[]> {
    const events = await dataSource.manager.find(AuthEvent, {
      where: { accountId },
      order: { occurredAt: 'ASC' },
    });
    return events.map((event) => event.type);
  }

  it('200 with the current code: AdminMeResponse, the admin cookie, the step accepted', async () => {
    const staff = await enrolStaff('admin');

    const response = await login(staff.email, staff.code()).expect(200);

    expect(response.body as AdminMeResponse).toEqual({
      account: { email: staff.email, role: 'admin' },
    });
    expect(adminCookieOf(response)).toMatch(/^edeep_admin_sid=[A-Za-z0-9_-]{43}$/);
    expect(await lastUsedStepOf(staff.account.id)).toBe(totpStepAt(now));
    expect(await dataSource.manager.countBy(Session, { accountId: staff.account.id })).toBe(1);
    expect(await eventTypesOf(staff.account.id)).toEqual(['account_created', 'login_succeeded']);
  });

  it('401 with a wrong code: same answer as a wrong password, login_failed, no session', async () => {
    const staff = await enrolStaff();
    const right = staff.code();
    const wrong = right === '000000' ? '000001' : '000000';

    const wrongCode = await login(staff.email, wrong).expect(401);
    const wrongPassword = await login(staff.email, right, 'another long passphrase').expect(401);

    expect(wrongCode.body).toEqual(INVALID_CREDENTIALS);
    expect(wrongPassword.body).toEqual(wrongCode.body);
    expect(wrongCode.headers['set-cookie']).toBeUndefined();
    expect(await dataSource.manager.countBy(Session, { accountId: staff.account.id })).toBe(0);
    expect(await eventTypesOf(staff.account.id)).toEqual([
      'account_created',
      'login_failed',
      'login_failed',
    ]);
    // A wrong password never consumes the step: the right code still works.
    expect(await lastUsedStepOf(staff.account.id)).toBeNull();
    await login(staff.email, right).expect(200);
  });

  it('401 for a replayed code: the same code twice within its step', async () => {
    const staff = await enrolStaff();
    const code = staff.code();
    await login(staff.email, code).expect(200);
    advance(10_000);

    const replay = await login(staff.email, code).expect(401);

    expect(replay.body).toEqual(INVALID_CREDENTIALS);
    expect(await dataSource.manager.countBy(Session, { accountId: staff.account.id })).toBe(1);
  });

  it('401 for an older code still inside the window once a newer step was accepted', async () => {
    const staff = await enrolStaff();
    const previous = staff.code(-1);
    await login(staff.email, staff.code()).expect(200);

    await login(staff.email, previous).expect(401);
    expect(await lastUsedStepOf(staff.account.id)).toBe(totpStepAt(now));
  });

  it('accepts the code of the previous step (late authenticator), not of two steps ago', async () => {
    const staff = await enrolStaff();

    await login(staff.email, staff.code(-2)).expect(401);
    await login(staff.email, staff.code(-1)).expect(200);
    expect(await lastUsedStepOf(staff.account.id)).toBe(totpStepAt(now) - 1);
  });

  it('accepts the next code once its step comes', async () => {
    const staff = await enrolStaff();
    await login(staff.email, staff.code()).expect(200);
    advance(STEP_MS);

    await login(staff.email, staff.code()).expect(200);
    expect(await lastUsedStepOf(staff.account.id)).toBe(totpStepAt(now));
  });

  it('lets only one of two concurrent logins with the same code through', async () => {
    const staff = await enrolStaff();
    const code = staff.code();

    const responses = await Promise.all([login(staff.email, code), login(staff.email, code)]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 401]);
    expect(await dataSource.manager.countBy(Session, { accountId: staff.account.id })).toBe(1);
    expect(await lastUsedStepOf(staff.account.id)).toBe(totpStepAt(now));
  });

  it('refuses a step accepted between the read of the account and its UPDATE (atomic acceptance)', async () => {
    const staff = await enrolStaff();
    const code = staff.code();
    // A concurrent login already accepted the step in the database…
    await dataSource.manager.update(
      Account,
      { id: staff.account.id },
      { totpLastUsedStep: totpStepAt(now) },
    );
    // …after this login read the account: its in-memory check sees no step yet and passes.
    const staffTotp = app.get(StaffTotp);
    const check = staffTotp.check.bind(staffTotp);
    const staleCheck = jest
      .spyOn(staffTotp, 'check')
      .mockImplementationOnce((account, submitted) =>
        check({ ...account, totpLastUsedStep: null }, submitted),
      );

    await login(staff.email, code).expect(401);
    expect(staleCheck).toHaveBeenCalledTimes(1);
    expect(await dataSource.manager.countBy(Session, { accountId: staff.account.id })).toBe(0);
    expect(await lastUsedStepOf(staff.account.id)).toBe(totpStepAt(now));
  });

  it('refuses a code of the old secret when account:reset-totp runs during the login (TOCTOU)', async () => {
    const staff = await enrolStaff();
    const code = staff.code();
    // The reset is committed while the login works on the account it read (old secret, step
    // NULL): during the Argon2id verification. Deterministic: no timing involved.
    const hasher = app.get(PasswordHasher);
    const verify = hasher.check.bind(hasher);
    const checkDuringReset = jest
      .spyOn(hasher, 'check')
      .mockImplementationOnce(async (password, hash) => {
        await app.get(AccountProvisioningService).resetTotp({ email: staff.email });
        return verify(password, hash);
      });

    const refused = await login(staff.email, code).expect(401);

    expect(checkDuringReset).toHaveBeenCalledTimes(1);
    expect(refused.body).toEqual(INVALID_CREDENTIALS);
    expect(refused.headers['set-cookie']).toBeUndefined();
    expect(await dataSource.manager.countBy(Session, { accountId: staff.account.id })).toBe(0);
    // The new enrolment keeps its fresh history: no step of the old secret was recorded.
    expect(await lastUsedStepOf(staff.account.id)).toBeNull();
    expect(await eventTypesOf(staff.account.id)).toEqual([
      'account_created',
      'totp_reset',
      'login_failed',
    ]);
  });

  it('401 for a diver account, password right, whatever the code', async () => {
    const response = await server()
      .post('/api/auth/register')
      .set('Sec-Fetch-Site', 'same-origin')
      .send({ firstName: 'Marine', email: 'marine@example.test', password: PASSWORD })
      .expect(201);
    expect(response.headers['set-cookie']).toBeDefined();

    const refused = await login('marine@example.test', '123456').expect(401);

    expect(refused.body).toEqual(INVALID_CREDENTIALS);
  });

  it('401 for a staff account without a secret (created before AddStaffTotp)', async () => {
    const staff = await enrolStaff();
    await dataSource.manager.update(Account, { id: staff.account.id }, { totpSecret: null });

    await login(staff.email, staff.code()).expect(401);
  });

  it('401 for a secret copied from another staff account (bound to its account id)', async () => {
    const victim = await enrolStaff();
    const attacker = await enrolStaff();
    const { totpSecret } = await dataSource.manager.findOneByOrFail(Account, {
      id: victim.account.id,
    });
    await dataSource.manager.update(Account, { id: attacker.account.id }, { totpSecret });

    await login(attacker.email, victim.code()).expect(401);
  });

  it('counts refused codes in the per-email throttle, like failed logins', async () => {
    const staff = await enrolStaff();
    const right = staff.code();
    const wrong = right === '000000' ? '000001' : '000000';
    for (let attempt = 0; attempt < LOGIN_THROTTLE_RULES.email.capacity; attempt += 1) {
      await login(staff.email, wrong).expect(401);
    }

    const throttled = await login(staff.email, right).expect(429);

    expect(throttled.body).toMatchObject({ code: 'too-many-attempts' });
  });

  describe('admin session lifetime (D42)', () => {
    async function signedIn(): Promise<string> {
      const staff = await enrolStaff();
      return adminCookieOf(await login(staff.email, staff.code()).expect(200));
    }

    const adminMe = (cookie: string) => server().get('/api/admin/me').set('Cookie', cookie);

    it('expires after 30 minutes of inactivity', async () => {
      const cookie = await signedIn();
      advance(29 * MINUTE_MS);
      // Activity: `last_seen_at` moves (written at most once a minute on the admin).
      await adminMe(cookie).expect(200);

      advance(29 * MINUTE_MS);
      await adminMe(cookie).expect(200);
      advance(30 * MINUTE_MS);

      await adminMe(cookie).expect(401);
    });

    it('expires after 8 hours, even when active', async () => {
      const cookie = await signedIn();
      for (let elapsed = 0; elapsed < 8 * 60 - 20; elapsed += 20) {
        advance(20 * MINUTE_MS);
        await adminMe(cookie).expect(200);
      }
      advance(20 * MINUTE_MS);

      await adminMe(cookie).expect(401);
    });

    it('is never a web session', async () => {
      const cookie = await signedIn();

      await server()
        .get('/api/me')
        .set('Cookie', cookie.replace(/^edeep_admin_sid=/, 'edeep_sid='))
        .expect(401);
    });
  });
});
