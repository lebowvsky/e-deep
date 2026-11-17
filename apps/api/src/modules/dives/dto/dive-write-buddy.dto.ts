import type { DiveWriteBuddy } from '@e-deep/shared';
import { IsBoolean, IsUUID } from 'class-validator';
import { IsText, Nullable, Required } from './validators/field-rules';

/** `ck_buddies__first_name` / `__last_name`, `ck_certification_levels__code`. */
const NAME_LENGTH = { min: 1, max: 100 } as const;
const LEVEL_CODE_LENGTH = { min: 1, max: 40 } as const;

export class DiveWriteBuddyDto implements DiveWriteBuddy {
  @Required()
  @IsUUID('all')
  id: string;

  /** Only used to create a new buddy (`isNew`). */
  @Required()
  @IsText(NAME_LENGTH.min, NAME_LENGTH.max)
  firstName: string;

  @Required()
  @IsText(NAME_LENGTH.min, NAME_LENGTH.max)
  lastName: string;

  /** `null`: unchanged for an existing buddy, none for a new one (D-21). */
  @Nullable()
  @IsText(LEVEL_CODE_LENGTH.min, LEVEL_CODE_LENGTH.max)
  levelCode: string | null;

  @Required()
  @IsBoolean()
  isNew: boolean;
}
