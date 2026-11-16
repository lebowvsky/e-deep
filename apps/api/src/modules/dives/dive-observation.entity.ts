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
import { DiveParticipation } from './dive-participation.entity';

/**
 * A species seen during a dive (D-19): free label, optional count, in the order the diver entered
 * them. Weak entity of the participation, synchronised with it like `dive_buddies` (no timestamps,
 * replaced as a whole by `upsertDive`; a trigger touches the participation). No `owner_id`: the
 * single FK is checked on the participation.
 */
@Entity({ name: 'dive_observations' })
@Unique('uq_dive_observations__participation_id_label', ['participationId', 'label'])
// Cap of 50 observations per participation, guaranteed by the database (RG-27).
@Check('ck_dive_observations__position', 'position BETWEEN 0 AND 49')
@Check('ck_dive_observations__label', 'char_length(btrim(label)) BETWEEN 1 AND 80')
@Check('ck_dive_observations__count', 'count IS NULL OR count BETWEEN 1 AND 9999')
export class DiveObservation {
  @PrimaryColumn('uuid', {
    name: 'participation_id',
    primaryKeyConstraintName: 'pk_dive_observations',
  })
  participationId: string;

  /** Index in the list sent by the client (0 to 49). */
  @PrimaryColumn('smallint', { name: 'position', primaryKeyConstraintName: 'pk_dive_observations' })
  position: number;

  /** Trimmed by the service; case is kept as entered (« Murène » and « murène » may coexist). */
  @Column({ type: 'text', name: 'label' })
  label: string;

  /** Number of individuals, `NULL` when not counted. */
  @Column({ type: 'smallint', name: 'count', nullable: true })
  count: number | null;

  // The PK `(participation_id, position)` covers the FK: no extra index.
  @ManyToOne(() => DiveParticipation, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({
    name: 'participation_id',
    foreignKeyConstraintName: 'fk_dive_observations__participation_id',
  })
  participation?: Relation<DiveParticipation>;
}
