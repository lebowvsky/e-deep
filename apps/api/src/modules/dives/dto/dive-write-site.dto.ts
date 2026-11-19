import type { DiveWriteSite } from '@e-deep/shared';
import { IsBoolean, IsUUID } from 'class-validator';
import { IsText, Required } from './validators/field-rules';

/** `ck_dive_sites__name`. */
const NAME_LENGTH = { min: 1, max: 120 } as const;

export class DiveWriteSiteDto implements DiveWriteSite {
  @Required()
  @IsUUID('all')
  id: string;

  /** Only used to create a new site (`isNew`). */
  @Required()
  @IsText(NAME_LENGTH.min, NAME_LENGTH.max)
  name: string;

  @Required()
  @IsBoolean()
  isNew: boolean;
}
