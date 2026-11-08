import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { Buddy } from '../buddies/buddy.entity';
import { Diver } from '../divers/diver.entity';
import { DiveParticipation } from './dive-participation.entity';

/**
 * Dive team of a participation (pure junction, synchronised with its participation: no timestamps).
 * `owner_id` is a control denormalisation: both composite FKs force the participation and the buddy
 * to belong to the same diver.
 */
@Entity({ name: 'dive_buddies' })
@Index('idx_dive_buddies__owner_id_buddy_id', ['ownerId', 'buddyId'])
export class DiveBuddy {
  @PrimaryColumn('uuid', { name: 'participation_id', primaryKeyConstraintName: 'pk_dive_buddies' })
  participationId: string;

  @PrimaryColumn('uuid', { name: 'buddy_id', primaryKeyConstraintName: 'pk_dive_buddies' })
  buddyId: string;

  @Column({ type: 'uuid', name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => Diver, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'owner_id', foreignKeyConstraintName: 'fk_dive_buddies__owner_id' })
  owner?: Relation<Diver>;

  @ManyToOne(() => DiveParticipation, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn([
    {
      name: 'owner_id',
      referencedColumnName: 'diverId',
      foreignKeyConstraintName: 'fk_dive_buddies__owner_id_participation_id',
    },
    {
      name: 'participation_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_dive_buddies__owner_id_participation_id',
    },
  ])
  participation?: Relation<DiveParticipation>;

  @ManyToOne(() => Buddy, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn([
    {
      name: 'owner_id',
      referencedColumnName: 'ownerId',
      foreignKeyConstraintName: 'fk_dive_buddies__owner_id_buddy_id',
    },
    {
      name: 'buddy_id',
      referencedColumnName: 'id',
      foreignKeyConstraintName: 'fk_dive_buddies__owner_id_buddy_id',
    },
  ])
  buddy?: Relation<Buddy>;
}
