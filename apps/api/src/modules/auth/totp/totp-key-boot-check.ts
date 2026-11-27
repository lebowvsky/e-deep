import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { DataSource, In, IsNull, Not } from 'typeorm';
import { STAFF_ROLES } from '../../accounts/account-lists';
import { Account } from '../../accounts/account.entity';
import { StaffTotp } from './staff-totp';

/** The API refuses to boot: a staff account exists, and its second factor could not be checked. */
export class TotpKeyRequiredError extends Error {
  override readonly name = 'TotpKeyRequiredError';

  constructor() {
    super('TOTP_ENCRYPTION_KEY is required: a staff account exists');
  }
}

/** The API refuses to boot: the configured key does not decrypt the stored staff secrets. */
export class TotpKeyMismatchError extends Error {
  override readonly name = 'TotpKeyMismatchError';

  constructor() {
    super('TOTP_ENCRYPTION_KEY does not decrypt the stored staff TOTP secrets');
  }
}

/**
 * `TOTP_ENCRYPTION_KEY` is optional in the environment schema (a fresh install has no staff), but
 * required as soon as a staff account exists (D42): the boot fails rather than serving an admin
 * login that can never succeed. With the key, one stored staff secret is decrypted: a wrong key
 * (another environment's, a rotated one) fails the boot too. The messages name the variable only:
 * never the key, a secret nor an account.
 */
@Injectable()
export class TotpKeyBootCheck implements OnApplicationBootstrap {
  constructor(
    private readonly dataSource: DataSource,
    private readonly staffTotp: StaffTotp,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const staffRoles = In([...STAFF_ROLES]);
    if (!this.staffTotp.isConfigured) {
      if (await this.dataSource.manager.existsBy(Account, { role: staffRoles })) {
        throw new TotpKeyRequiredError();
      }
      return;
    }
    const enrolled = await this.dataSource.manager.findOne(Account, {
      select: { id: true, totpSecret: true },
      where: { role: staffRoles, totpSecret: Not(IsNull()) },
      order: { id: 'ASC' },
    });
    if (enrolled === null || enrolled.totpSecret === null) {
      return;
    }
    if (!this.staffTotp.decrypts(enrolled.id, enrolled.totpSecret)) {
      throw new TotpKeyMismatchError();
    }
  }
}
