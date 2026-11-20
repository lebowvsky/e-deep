import type { ConsentPurpose } from '@e-deep/shared';
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
import { Diver } from '../divers/diver.entity';

/** At most one live (not withdrawn) consent per diver and purpose. */
export const LIVE_CONSENT_UNIQUE_INDEX = 'uq_consents__live';

/**
 * Consent of a diver (GDPR art. 9.2.a, D38). A new policy version withdraws the live consent and
 * inserts the new one in a single transaction, so the history of versions is kept. In V1 there is
 * no withdrawal alone: withdrawing means deleting the account.
 */
@Entity({ name: 'consents' })
// Lookup of the live consent.
@Index(LIVE_CONSENT_UNIQUE_INDEX, ['diverId', 'purpose'], {
  unique: true,
  where: 'withdrawn_at IS NULL',
})
// Covers the `diver_id` FK for every row (the partial index above skips the withdrawn ones): the
// erasure cascade (art. 17) does not scan the table.
@Index('idx_consents__diver_id', ['diverId'])
@Check('ck_consents__purpose', "purpose IN ('health_data_processing')")
@Check('ck_consents__policy_version', 'char_length(policy_version) BETWEEN 1 AND 32')
@Check('ck_consents__withdrawn_after_granted', 'withdrawn_at IS NULL OR withdrawn_at >= granted_at')
export class Consent {
  @PrimaryColumn('uuid', {
    name: 'id',
    default: () => 'uuidv7()',
    primaryKeyConstraintName: 'pk_consents',
  })
  id: string;

  @Column({ type: 'uuid', name: 'diver_id' })
  diverId: string;

  @ManyToOne(() => Diver, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'diver_id', foreignKeyConstraintName: 'fk_consents__diver_id' })
  diver?: Relation<Diver>;

  @Column({ type: 'text', name: 'purpose' })
  purpose: ConsentPurpose;

  /** A `HealthPolicyVersion` of `@e-deep/shared` when written; older versions stay readable. */
  @Column({ type: 'text', name: 'policy_version' })
  policyVersion: string;

  @Column({ type: 'timestamptz', name: 'granted_at', default: () => 'now()' })
  grantedAt: Date;

  @Column({ type: 'timestamptz', name: 'withdrawn_at', nullable: true })
  withdrawnAt: Date | null;
}
