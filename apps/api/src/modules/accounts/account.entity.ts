import type { AccountRole } from '@e-deep/shared';
import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
  type Relation,
} from 'typeorm';
import { TimestampedEntity } from '../../common/database/timestamped.entity';
import { Diver } from '../divers/diver.entity';

/**
 * Means of signing in (D36): the diver stays the owner of the data, the account only authenticates
 * them. A staff account (`support`, `admin`) never has a diver. Erasure (art. 17) is a
 * `DELETE divers` that cascades here, then to the sessions and the auth events.
 */
@Entity({ name: 'accounts' })
@Unique('uq_accounts__email', ['email'])
// Also covers the `diver_id` FK.
@Unique('uq_accounts__diver_id', ['diverId'])
@Check(
  'ck_accounts__email',
  "email = lower(btrim(email)) AND char_length(email) BETWEEN 3 AND 254 AND position('@' in email) > 1",
)
@Check('ck_accounts__password_hash', "starts_with(password_hash, '$argon2id$')")
@Check('ck_accounts__role', "role IN ('diver', 'support', 'admin')")
@Check('ck_accounts__diver_role', "(role = 'diver') = (diver_id IS NOT NULL)")
export class Account extends TimestampedEntity {
  @PrimaryColumn('uuid', {
    name: 'id',
    default: () => 'uuidv7()',
    primaryKeyConstraintName: 'pk_accounts',
  })
  id: string;

  /** `NULL` for a staff account only (`ck_accounts__diver_role`). */
  @Column({ type: 'uuid', name: 'diver_id', nullable: true })
  diverId: string | null;

  // `ManyToOne` + `uq_accounts__diver_id` rather than `OneToOne`, which adds an unnamed UNIQUE.
  @ManyToOne(() => Diver, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'diver_id', foreignKeyConstraintName: 'fk_accounts__diver_id' })
  diver?: Relation<Diver> | null;

  /** Normalised by the service (`lower` + `btrim`), checked by `ck_accounts__email`; no `citext`. */
  @Column({ type: 'text', name: 'email' })
  email: string;

  /** Argon2id hash in PHC format (D35). Never logged nor returned. */
  @Column({ type: 'text', name: 'password_hash' })
  passwordHash: string;

  @Column({ type: 'text', name: 'role', default: 'diver' })
  role: AccountRole;

  /** Prepared for the email lot (D39): always `NULL` in V1. */
  @Column({ type: 'timestamptz', name: 'email_verified_at', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'password_changed_at', default: () => 'now()' })
  passwordChangedAt: Date;
}
