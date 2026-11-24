import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { createStaffAccountCommand } from '../../src/cli/create-staff-account';
import { resetPasswordCommand } from '../../src/cli/reset-password';
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
import { Fixtures } from './support/fixtures';
import { createTestDataSource, resetDatabase } from './support/test-database';

/** Cheap Argon2id parameters: these tests check the writes, not the cost. */
const FAST = { memoryKib: 64, passes: 1, parallelism: 1 };
const PASSWORD = 'harbour signal 2031 slowly';
const COMPROMISED = 'correct horse battery staple';

describe('operator commands (account:create-staff, account:reset-password)', () => {
  let dataSource: DataSource;
  let fixtures: Fixtures;
  let hasher: PasswordHasher;
  let provisioning: AccountProvisioningService;
  const typed = (password: string) => () => Promise.resolve(password);

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    fixtures = new Fixtures(dataSource);
    hasher = await PasswordHasher.create(FAST);
    provisioning = new AccountProvisioningService(
      dataSource,
      hasher,
      new PasswordPolicy(new Set([COMPROMISED])),
      new SessionService(dataSource, systemClock),
      new AuthEventsService(dataSource),
    );
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
      );

      expect(output).toBe('Staff account created.');
      const account = await dataSource.manager.findOneByOrFail(Account, {
        email: 'ops@example.test',
      });
      expect(account).toMatchObject({ role: 'admin', diverId: null });
      await expect(hasher.verify(PASSWORD, account.passwordHash)).resolves.toBe(true);
      expect(await dataSource.manager.findBy(AuthEvent, { accountId: account.id })).toEqual([
        expect.objectContaining({ type: 'account_created' }),
      ]);
    });

    it('refuses an email already used, without the email in the error', async () => {
      await fixtures.account(null, { email: 'ops@example.test' });

      const failure = createStaffAccountCommand(
        provisioning,
        ['support', 'ops@example.test'],
        typed(PASSWORD),
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
});
