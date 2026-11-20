import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { Account } from '../accounts/account.entity';
import type { SessionAudience } from './session-audiences';

/**
 * Opaque server session (D33). Only the SHA-256 of the token is stored, read through its unique
 * index on every request. The idle expiry is derived from `last_seen_at` and the audience
 * (configured in code, not stored); `expires_at` is the absolute expiry. No `updated_at`: a session
 * is never edited, only touched (`last_seen_at`) or deleted.
 */
@Entity({ name: 'sessions' })
@Unique('uq_sessions__token_hash', ['tokenHash'])
@Index('idx_sessions__account_id', ['accountId'])
// Purge of the expired sessions.
@Index('idx_sessions__expires_at', ['expiresAt'])
@Check('ck_sessions__token_hash', 'octet_length(token_hash) = 32')
@Check('ck_sessions__audience', "audience IN ('web', 'admin')")
export class Session {
  @PrimaryColumn('uuid', {
    name: 'id',
    default: () => 'uuidv7()',
    primaryKeyConstraintName: 'pk_sessions',
  })
  id: string;

  @Column({ type: 'uuid', name: 'account_id' })
  accountId: string;

  @ManyToOne(() => Account, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'fk_sessions__account_id' })
  account?: Relation<Account>;

  /** SHA-256 of the token (32 bytes); the token itself is never stored nor logged. */
  @Column({ type: 'bytea', name: 'token_hash' })
  tokenHash: Buffer;

  @Column({ type: 'text', name: 'audience' })
  audience: SessionAudience;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at', default: () => 'now()' })
  createdAt: Date;

  /** Written at most once a minute (admin) or an hour (web). */
  @Column({ type: 'timestamptz', name: 'last_seen_at', default: () => 'now()' })
  lastSeenAt: Date;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;
}
