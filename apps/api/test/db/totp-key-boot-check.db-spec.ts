import { randomBytes } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { systemClock } from '../../src/common/time/clock';
import { StaffTotp } from '../../src/modules/auth/totp/staff-totp';
import { Account } from '../../src/modules/accounts/account.entity';
import {
  TotpKeyBootCheck,
  TotpKeyMismatchError,
  TotpKeyRequiredError,
} from '../../src/modules/auth/totp/totp-key-boot-check';
import { TotpSecretCipher } from '../../src/modules/auth/totp/totp-secret-cipher';
import { Fixtures } from './support/fixtures';
import { createTestDataSource, resetDatabase } from './support/test-database';

// `TOTP_ENCRYPTION_KEY` is optional until a staff account exists (D42): then the API boot fails.

describe('TotpKeyBootCheck', () => {
  let dataSource: DataSource;
  let fixtures: Fixtures;
  const withoutKey = () => new TotpKeyBootCheck(dataSource, new StaffTotp(null, systemClock));

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    fixtures = new Fixtures(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  it('lets the API boot without the key while no staff account exists', async () => {
    await fixtures.account((await fixtures.diver()).id);

    await expect(withoutKey().onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it.each(['support', 'admin'] as const)(
    'refuses the boot without the key once a %s account exists, naming the variable only',
    async (role) => {
      await fixtures.account(null, { role, email: 'ops@example.test' });

      const boot = withoutKey().onApplicationBootstrap();

      await expect(boot).rejects.toThrow(TotpKeyRequiredError);
      await expect(boot).rejects.toThrow('TOTP_ENCRYPTION_KEY is required: a staff account exists');
      await expect(boot).rejects.not.toThrow(/ops@/);
    },
  );

  const withKey = (key: Buffer) =>
    new TotpKeyBootCheck(dataSource, StaffTotp.fromEncodedKey(key.toString('base64'), systemClock));

  /** A staff account whose secret is encrypted with `key`; the secret, for the leak checks. */
  async function staffEnrolledWith(key: Buffer, email = 'ops@example.test') {
    const account = await fixtures.account(null, { role: 'admin', email });
    const secret = randomBytes(20);
    const totpSecret = new TotpSecretCipher(key).encrypt(secret, account.id);
    await dataSource.manager.update(Account, { id: account.id }, { totpSecret });
    return { secret, totpSecret };
  }

  it('lets the API boot with the key, staff or not', async () => {
    await expect(withKey(randomBytes(32)).onApplicationBootstrap()).resolves.toBeUndefined();
    // A staff account not enrolled yet (no secret): nothing to decrypt.
    await fixtures.account(null, { role: 'admin' });

    await expect(withKey(randomBytes(32)).onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it('lets the API boot when the key decrypts the stored staff secret', async () => {
    const key = randomBytes(32);
    await staffEnrolledWith(key);

    await expect(withKey(key).onApplicationBootstrap()).resolves.toBeUndefined();
  });

  it('refuses the boot with a wrong key, naming the variable only', async () => {
    const key = randomBytes(32);
    const wrongKey = randomBytes(32);
    const { secret, totpSecret } = await staffEnrolledWith(key);

    const boot = withKey(wrongKey).onApplicationBootstrap();

    await expect(boot).rejects.toThrow(TotpKeyMismatchError);
    const error: unknown = await boot.catch((failure: unknown) => failure);
    const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : '';
    expect(message).toContain('TOTP_ENCRYPTION_KEY does not decrypt the stored staff TOTP secrets');
    for (const leaked of [
      totpSecret,
      secret.toString('base64'),
      secret.toString('hex'),
      key.toString('base64'),
      wrongKey.toString('base64'),
      'ops@',
    ]) {
      expect(message).not.toContain(leaked);
    }
  });
});
