import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Account } from '../../modules/accounts/account.entity';
import { Diver } from '../../modules/divers/diver.entity';
import type { DevStubAccount } from './auth-context';

/**
 * DEVELOPMENT ONLY, removed in auth lot 6 (D44): the account of the first diver created (the
 * seed's Marine Rousseau), for the `SessionGuard` fallback without a cookie. Whether the fallback
 * applies at all (`DEV_AUTH_STUB`, `NODE_ENV`) is the guard's decision, not this lookup's.
 */
@Injectable()
export class DevAuthStub {
  constructor(private readonly dataSource: DataSource) {}

  /** `null` when there is no diver, or when the first one has no account to act for. */
  async firstDiverAccount(): Promise<DevStubAccount | null> {
    const [diver] = await this.dataSource.manager.find(Diver, {
      select: { id: true },
      order: { createdAt: 'ASC', id: 'ASC' },
      take: 1,
    });
    if (diver === undefined) {
      return null;
    }
    const account = await this.dataSource.manager.findOne(Account, {
      select: { id: true },
      where: { diverId: diver.id },
    });
    return account === null ? null : { accountId: account.id, diverId: diver.id };
  }
}
