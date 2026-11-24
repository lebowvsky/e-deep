import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { AuthEvent } from './auth-event.entity';
import type { AuthEventType } from './auth-event-types';

/**
 * Security trail (D40): the type and the instant only, no IP, user agent, email nor token.
 * `account_id` is `null` when no account applies (unknown email, deleted account).
 */
@Injectable()
export class AuthEventsService {
  constructor(private readonly dataSource: DataSource) {}

  record(accountId: string | null, type: AuthEventType): Promise<void> {
    return this.recordIn(this.dataSource.manager, accountId, type);
  }

  /** Same as `record`, inside the caller's transaction. */
  async recordIn(
    manager: EntityManager,
    accountId: string | null,
    type: AuthEventType,
  ): Promise<void> {
    await manager.insert(AuthEvent, { accountId, type });
  }
}
