import { randomBytes } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { DataSource, QueryRunner } from 'typeorm';
import { CliUsageError } from '../../src/cli/cli-runtime';
import { createStaffAccountCommand } from '../../src/cli/create-staff-account';
import { resetPasswordCommand } from '../../src/cli/reset-password';
import { resetTotpCommand } from '../../src/cli/reset-totp';
import {
  DomainValidationError,
  EmailTakenError,
  InvalidReferenceError,
} from '../../src/common/errors/domain-errors';
import { systemClock } from '../../src/common/time/clock';
import { AccountProvisioningService } from '../../src/modules/accounts/account-provisioning.service';
import { Account } from '../../src/modules/accounts/account.entity';
import { AuthEvent } from '../../src/modules/auth/auth-event.entity';
import { AuthEventsService } from '../../src/modules/auth/auth-events.service';
import { PasswordHasher } from '../../src/modules/auth/password/password-hasher';
import { PasswordPolicy } from '../../src/modules/auth/password/password-policy';
import { Session } from '../../src/modules/auth/session.entity';
import { SessionService } from '../../src/modules/auth/session.service';
import { StaffTotp, TotpKeyMissingError } from '../../src/modules/auth/totp/staff-totp';
import { encodeBase32 } from '../../src/modules/auth/totp/totp';
import { TotpSecretCipher } from '../../src/modules/auth/totp/totp-secret-cipher';
import { otpauthUriIn, secretOf } from '../support/authenticator';
import { Fixtures } from './support/fixtures';
import { selectRows } from './support/sql';
import { createTestDataSource, resetDatabase } from './support/test-database';

/** Cheap Argon2id parameters: these tests check the writes, not the cost. */
const FAST = { memoryKib: 64, passes: 1, parallelism: 1 };
const PASSWORD = 'harbour signal 2031 slowly';
const COMPROMISED = 'correct horse battery staple';
const CIPHER = new TotpSecretCipher(randomBytes(32));
/** The commands print the enrolment URI to an interactive terminal only. */
const TERMINAL = () => true;
const REDIRECTED = () => false;

describe('operator commands (account:create-staff, account:reset-password, account:reset-totp)', () => {
  let dataSource: DataSource;
  let fixtures: Fixtures;
  let hasher: PasswordHasher;
  let provisioning: AccountProvisioningService;
  const typed = (password: string) => () => Promise.resolve(password);

  function provisioningWith(staffTotp: StaffTotp): AccountProvisioningService {
    return new AccountProvisioningService(
      dataSource,
      hasher,
      new PasswordPolicy(new Set([COMPROMISED])),
      new SessionService(dataSource, systemClock),
      new AuthEventsService(dataSource),
      staffTotp,
    );
  }

  /** The secret stored for the account, decrypted with the key of the commands. */
  async function storedSecretOf(accountId: string): Promise<Buffer> {
    const { totpSecret } = await dataSource.manager.findOneByOrFail(Account, { id: accountId });
    return CIPHER.decrypt(totpSecret ?? '', accountId);
  }

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    fixtures = new Fixtures(dataSource);
    hasher = await PasswordHasher.create(FAST);
    provisioning = provisioningWith(new StaffTotp(CIPHER, systemClock));
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create-staff', () => {
    it('creates a staff account without a diver, the email normalised, the trail written', async () => {
      const output = await createStaffAccountCommand(
        provisioning,
        ['admin', '  Ops@Example.TEST '],
        typed(PASSWORD),
        TERMINAL,
      );

      expect(output.split('\n')[0]).toBe('Staff account created.');
      const account = await dataSource.manager.findOneByOrFail(Account, {
        email: 'ops@example.test',
      });
      expect(account).toMatchObject({ role: 'admin', diverId: null, totpLastUsedStep: null });
      await expect(hasher.verify(PASSWORD, account.passwordHash)).resolves.toBe(true);
      expect(await dataSource.manager.findBy(AuthEvent, { accountId: account.id })).toEqual([
        expect.objectContaining({ type: 'account_created' }),
      ]);
    });

    it('enrols the account in TOTP: secret stored encrypted for it, printed once in the URI', async () => {
      const output = await createStaffAccountCommand(
        provisioning,
        ['support', 'ops@example.test'],
        typed(PASSWORD),
        TERMINAL,
      );

      const uri = otpauthUriIn(output);
      const account = await dataSource.manager.findOneByOrFail(Account, {
        email: 'ops@example.test',
      });
      const secret = await storedSecretOf(account.id);
      expect(secret).toHaveLength(20);
      expect(secretOf(uri).equals(secret)).toBe(true);
      expect(uri).toBe(
        `otpauth://totp/E-Deep:ops%40example.test?secret=${encodeBase32(secret)}&issuer=E-Deep&algorithm=SHA1&digits=6&period=30`,
      );
      expect(account.totpSecret).toMatch(/^v1\./);
      expect(account.totpSecret).not.toContain(encodeBase32(secret));
    });

    it('refuses a redirected output before creating anything', async () => {
      await expect(
        createStaffAccountCommand(
          provisioning,
          ['support', 'ops@example.test'],
          typed(PASSWORD),
          REDIRECTED,
        ),
      ).rejects.toThrow(CliUsageError);
      expect(await dataSource.manager.count(Account)).toBe(0);
      expect(await dataSource.manager.count(AuthEvent)).toBe(0);
    });

    it('refuses without TOTP_ENCRYPTION_KEY, writing nothing', async () => {
      const withoutKey = provisioningWith(new StaffTotp(null, systemClock));

      await expect(
        createStaffAccountCommand(
          withoutKey,
          ['support', 'ops@example.test'],
          typed(PASSWORD),
          TERMINAL,
        ),
      ).rejects.toThrow(TotpKeyMissingError);
      expect(await dataSource.manager.count(Account)).toBe(0);
    });

    it('refuses an email already used, without the email in the error', async () => {
      await fixtures.account(null, { email: 'ops@example.test' });

      const failure = createStaffAccountCommand(
        provisioning,
        ['support', 'ops@example.test'],
        typed(PASSWORD),
        TERMINAL,
      );

      await expect(failure).rejects.toThrow(EmailTakenError);
      await expect(failure).rejects.not.toThrow(/ops@/);
    });

    it.each([
      ['too short', 'short one', ['too-short']],
      ['compromised', COMPROMISED, ['compromised']],
      ['containing the email', 'opsteam-ops@example.test-x', ['contains-identity']],
      ['over 128 code points as typed', '🐠'.repeat(129), ['too-long']],
    ])('refuses a password %s, writing nothing', async (_case, password, codes) => {
      const failure = provisioning.createStaffAccount({
        role: 'support',
        email: 'ops@example.test',
        password,
      });

      await expect(failure).rejects.toThrow(DomainValidationError);
      await expect(failure).rejects.toMatchObject({ fieldErrors: { password: codes } });
      expect(await dataSource.manager.count(Account)).toBe(0);
    });

    it.each([
      ['not an address for the sign-in DTO (no domain)', 'ops@localhost', ['format']],
      ['not an address at all', 'ops', ['format']],
      ['over 254 characters', `ops@${'a'.repeat(250)}.test`, ['length']],
      ['non-ASCII, which the accounts cannot hold', 'opé@example.test', ['invalid-character']],
    ])('refuses an email %s, writing nothing', async (_case, email, codes) => {
      await expect(
        provisioning.createStaffAccount({ role: 'support', email, password: PASSWORD }),
      ).rejects.toMatchObject({ fieldErrors: { email: codes } });
      expect(await dataSource.manager.count(Account)).toBe(0);
    });
  });

  describe('reset-password', () => {
    it('sets the new password, ends every session and writes the trail', async () => {
      const diver = await fixtures.diver({ firstName: 'Marine', lastName: 'Rousseau' });
      const account = await fixtures.account(diver.id, { email: 'marine@example.test' });
      await fixtures.session(account.id);
      await fixtures.session(account.id);

      const output = await resetPasswordCommand(
        provisioning,
        ['Marine@Example.test'],
        typed(PASSWORD),
      );

      expect(output).toBe('Password reset; every session of the account ended.');
      const updated = await dataSource.manager.findOneByOrFail(Account, { id: account.id });
      await expect(hasher.verify(PASSWORD, updated.passwordHash)).resolves.toBe(true);
      expect(updated.passwordChangedAt.getTime()).toBeGreaterThanOrEqual(
        account.passwordChangedAt.getTime(),
      );
      expect(await dataSource.manager.countBy(Session, { accountId: account.id })).toBe(0);
      expect(await dataSource.manager.findBy(AuthEvent, { accountId: account.id })).toEqual([
        expect.objectContaining({ type: 'password_reset_by_operator' }),
      ]);
    });

    it('applies the policy with the identity of the diver', async () => {
      const diver = await fixtures.diver({ firstName: 'Marine', lastName: 'Rousseau' });
      const account = await fixtures.account(diver.id, { email: 'diver-1@example.test' });
      await fixtures.session(account.id);

      await expect(
        provisioning.resetPassword({
          email: 'diver-1@example.test',
          password: 'rousseau dives at night',
        }),
      ).rejects.toMatchObject({ fieldErrors: { password: ['contains-identity'] } });
      expect(await dataSource.manager.countBy(Session, { accountId: account.id })).toBe(1);
    });

    it('refuses an unknown email', async () => {
      await expect(
        provisioning.resetPassword({ email: 'nobody@example.test', password: PASSWORD }),
      ).rejects.toThrow(InvalidReferenceError);
    });
  });

  describe('reset-totp', () => {
    async function enrolledStaff(): Promise<Account> {
      await createStaffAccountCommand(
        provisioning,
        ['admin', 'ops@example.test'],
        typed(PASSWORD),
        TERMINAL,
      );
      const account = await dataSource.manager.findOneByOrFail(Account, {
        email: 'ops@example.test',
      });
      await dataSource.manager.update(Account, { id: account.id }, { totpLastUsedStep: 42 });
      return account;
    }

    it('replaces the secret, clears the last step, ends every session and writes the trail', async () => {
      const account = await enrolledStaff();
      const previous = await storedSecretOf(account.id);
      await fixtures.session(account.id, { audience: 'admin' });
      await fixtures.session(account.id, { audience: 'admin' });

      const output = await resetTotpCommand(provisioning, ['  Ops@Example.TEST '], TERMINAL);

      expect(output.split('\n')[0]).toBe(
        'TOTP secret replaced; every session of the account ended.',
      );
      const secret = await storedSecretOf(account.id);
      expect(secret.equals(previous)).toBe(false);
      expect(secretOf(otpauthUriIn(output)).equals(secret)).toBe(true);
      expect(await dataSource.manager.findOneByOrFail(Account, { id: account.id })).toMatchObject({
        totpLastUsedStep: null,
        passwordHash: account.passwordHash,
      });
      expect(await dataSource.manager.countBy(Session, { accountId: account.id })).toBe(0);
      const events = await dataSource.manager.findBy(AuthEvent, { accountId: account.id });
      expect(events.map((event) => event.type).sort()).toEqual(['account_created', 'totp_reset']);
    });

    it.each([
      ['an unknown email', () => Promise.resolve()],
      [
        'a diver account',
        async () => {
          const diver = await fixtures.diver();
          await fixtures.account(diver.id, { email: 'ops@example.test' });
        },
      ],
    ])('refuses %s with the same generic error, writing nothing', async (_case, arrange) => {
      await arrange();
      const before = await dataSource.manager.find(Account);

      const failure = resetTotpCommand(provisioning, ['ops@example.test'], TERMINAL);

      await expect(failure).rejects.toThrow(InvalidReferenceError);
      await expect(failure).rejects.not.toThrow(/ops@/);
      expect(await dataSource.manager.find(Account)).toEqual(before);
      expect(await dataSource.manager.countBy(AuthEvent, { type: 'totp_reset' })).toBe(0);
    });

    /** Another transaction holding `FOR UPDATE` on the account row, until it ends. */
    async function lockAccountRow(accountId: string): Promise<QueryRunner> {
      const runner = dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      await runner.query('SELECT id FROM accounts WHERE id = $1 FOR UPDATE', [accountId]);
      return runner;
    }

    /**
     * Resolves once the reset waits on the row lock with its read of the account (`SELECT … FOR
     * UPDATE`, not a later `UPDATE`). The suite runs in band: no other query of the tests waits.
     */
    async function untilTheLockedReadWaits(): Promise<void> {
      for (let attempt = 0; attempt < 300; attempt += 1) {
        const [row] = await selectRows<{ count: number }>(
          dataSource,
          `SELECT count(*)::int AS count FROM pg_stat_activity
            WHERE datname = current_database() AND wait_event_type = 'Lock'
              AND query ILIKE 'SELECT%FOR UPDATE%'`,
        );
        if ((row?.count ?? 0) > 0) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error('The locked read of the account never waited');
    }

    it('reads the account under FOR UPDATE: a concurrent reset waits for the row lock', async () => {
      const account = await enrolledStaff();
      const holder = await lockAccountRow(account.id);
      let settled = false;

      const reset = provisioning.resetTotp({ email: account.email }).finally(() => {
        settled = true;
      });
      try {
        await untilTheLockedReadWaits();
        expect(settled).toBe(false);
        expect(
          (await dataSource.manager.findOneByOrFail(Account, { id: account.id })).totpSecret,
        ).toBe(account.totpSecret);
      } finally {
        await holder.commitTransaction();
        await holder.release();
      }

      const { otpauthUri } = await reset;
      expect(secretOf(otpauthUri).equals(await storedSecretOf(account.id))).toBe(true);
    });

    it('serialises two concurrent resets: the stored secret is the one of the last, both traced', async () => {
      const account = await enrolledStaff();

      const enrolments = await Promise.all([
        provisioning.resetTotp({ email: account.email }),
        provisioning.resetTotp({ email: account.email }),
      ]);

      const stored = await storedSecretOf(account.id);
      const matching = enrolments.filter(({ otpauthUri }) => secretOf(otpauthUri).equals(stored));
      expect(matching).toHaveLength(1);
      expect(await dataSource.manager.countBy(AuthEvent, { type: 'totp_reset' })).toBe(2);
    });

    it('refuses an account deleted while the reset waits for its row: invalid-reference, no FK error', async () => {
      const account = await enrolledStaff();
      const holder = await lockAccountRow(account.id);

      const reset = provisioning.resetTotp({ email: account.email });
      // Observed whatever the outcome, so that a rejection is never unhandled meanwhile.
      const outcome = reset.then(
        () => null,
        (error: unknown) => error,
      );
      try {
        await untilTheLockedReadWaits();
        await holder.query('DELETE FROM accounts WHERE id = $1', [account.id]);
      } finally {
        await holder.commitTransaction();
        await holder.release();
      }

      expect(await outcome).toBeInstanceOf(InvalidReferenceError);
      expect(await dataSource.manager.countBy(AuthEvent, { type: 'totp_reset' })).toBe(0);
    });

    it('refuses a redirected output before the reset, changing nothing', async () => {
      const account = await enrolledStaff();
      const before = await dataSource.manager.findOneByOrFail(Account, { id: account.id });
      await fixtures.session(account.id, { audience: 'admin' });

      await expect(resetTotpCommand(provisioning, [account.email], REDIRECTED)).rejects.toThrow(
        CliUsageError,
      );
      expect(await dataSource.manager.findOneByOrFail(Account, { id: account.id })).toEqual(before);
      expect(await dataSource.manager.countBy(Session, { accountId: account.id })).toBe(1);
      expect(await dataSource.manager.countBy(AuthEvent, { type: 'totp_reset' })).toBe(0);
    });

    it('refuses without TOTP_ENCRYPTION_KEY, changing nothing', async () => {
      const account = await enrolledStaff();
      const before = await dataSource.manager.findOneByOrFail(Account, { id: account.id });
      await fixtures.session(account.id, { audience: 'admin' });

      await expect(
        resetTotpCommand(
          provisioningWith(new StaffTotp(null, systemClock)),
          [account.email],
          TERMINAL,
        ),
      ).rejects.toThrow(TotpKeyMissingError);
      expect(await dataSource.manager.findOneByOrFail(Account, { id: account.id })).toEqual(before);
      expect(await dataSource.manager.countBy(Session, { accountId: account.id })).toBe(1);
    });
  });
});
