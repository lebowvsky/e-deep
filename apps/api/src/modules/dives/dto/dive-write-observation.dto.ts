import type { DiveWriteObservation } from '@e-deep/shared';
import { Max, Min } from 'class-validator';
import { IsInteger, IsText, Nullable, Required } from './validators/field-rules';

/** Bounds of the `dive_observations` CHECKs (H-17). */
const LABEL_LENGTH = { min: 1, max: 80 } as const;
const COUNT = { min: 1, max: 9999 } as const;

export class DiveWriteObservationDto implements DiveWriteObservation {
  /** Stored trimmed, case kept (D-19). */
  @Required()
  @IsText(LABEL_LENGTH.min, LABEL_LENGTH.max)
  label: string;

  @Nullable()
  @IsInteger()
  @Min(COUNT.min)
  @Max(COUNT.max)
  count: number | null;
}
