import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Account } from '../accounts/account.entity';
import type { AuthEventType } from './auth-event-types';

/**
 * Security trail of the accounts (D40): the event type and its instant only, no IP, user agent,
 * email nor token. Purged after 180 days. `account_deleted` is written without an account, which
 * is gone by then.
 */
@Entity({ name: 'auth_events' })
@Index('idx_auth_events__account_id', ['accountId'])
// Purge by age.
@Index('idx_auth_events__occurred_at', ['occurredAt'])
@Check(
  'ck_auth_events__type',
  "type IN ('login_succeeded', 'login_failed', 'login_throttled', 'logout', 'sessions_revoked', 'password_changed', 'password_reset_by_operator', 'consent_granted', 'account_deleted')",
)
export class AuthEvent {
  @PrimaryColumn('uuid', {
    name: 'id',
    default: () => 'uuidv7()',
    primaryKeyConstraintName: 'pk_auth_events',
  })
  id: string;

  @Column({ type: 'uuid', name: 'account_id', nullable: true })
  accountId: string | null;

  @ManyToOne(() => Account, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'fk_auth_events__account_id' })
  account?: Relation<Account> | null;

  @Column({ type: 'text', name: 'type' })
  type: AuthEventType;

  @Column({ type: 'timestamptz', name: 'occurred_at', default: () => 'now()' })
  occurredAt: Date;
}
