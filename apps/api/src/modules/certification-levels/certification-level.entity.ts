import { Check, Column, Entity, PrimaryColumn, Unique } from 'typeorm';
import { TimestampedEntity } from '../../common/database/timestamped.entity';

/** Read-only reference data: an obsolete level is deactivated (`is_active = false`), never deleted. */
@Entity({ name: 'certification_levels' })
@Unique('uq_certification_levels__agency_code', ['agency', 'code'])
@Check('ck_certification_levels__agency', 'char_length(btrim(agency)) BETWEEN 1 AND 40')
@Check('ck_certification_levels__code', 'char_length(btrim(code)) BETWEEN 1 AND 40')
@Check('ck_certification_levels__label', 'char_length(btrim(label)) BETWEEN 1 AND 120')
@Check('ck_certification_levels__rank', 'rank > 0')
export class CertificationLevel extends TimestampedEntity {
  @PrimaryColumn('uuid', {
    name: 'id',
    default: () => 'uuidv7()',
    primaryKeyConstraintName: 'pk_certification_levels',
  })
  id: string;

  @Column({ type: 'text', name: 'agency' })
  agency: string;

  @Column({ type: 'text', name: 'code' })
  code: string;

  @Column({ type: 'text', name: 'label' })
  label: string;

  /** Orders levels across agencies. */
  @Column({ type: 'smallint', name: 'rank' })
  rank: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;
}
