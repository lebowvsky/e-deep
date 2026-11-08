import {
  Check,
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  type Relation,
} from 'typeorm';
import { TimestampedEntity } from '../../common/database/timestamped.entity';
import { CertificationLevel } from '../certification-levels/certification-level.entity';

@Entity({ name: 'divers' })
@Check('ck_divers__first_name', 'char_length(btrim(first_name)) BETWEEN 1 AND 100')
@Check('ck_divers__last_name', 'char_length(btrim(last_name)) BETWEEN 1 AND 100')
@Check('ck_divers__avatar_url', 'avatar_url IS NULL OR char_length(avatar_url) <= 2048')
export class Diver extends TimestampedEntity {
  @PrimaryColumn('uuid', {
    name: 'id',
    default: () => 'uuidv7()',
    primaryKeyConstraintName: 'pk_divers',
  })
  id: string;

  @Column({ type: 'text', name: 'first_name' })
  firstName: string;

  @Column({ type: 'text', name: 'last_name' })
  lastName: string;

  /** Current level; it determines the agency. Must be active when chosen (service rule). */
  @Column({ type: 'uuid', name: 'certification_level_id' })
  certificationLevelId: string;

  // Deliberately not indexed: levels are never deleted.
  @ManyToOne(() => CertificationLevel, { onDelete: 'RESTRICT', nullable: false })
  @JoinColumn({
    name: 'certification_level_id',
    foreignKeyConstraintName: 'fk_divers__certification_level_id',
  })
  certificationLevel?: Relation<CertificationLevel>;

  @Column({ type: 'text', name: 'avatar_url', nullable: true })
  avatarUrl: string | null;
}
