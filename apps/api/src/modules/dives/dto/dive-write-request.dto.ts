import type { DiveWriteRequest } from '@e-deep/shared';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsObject, ValidateNested } from 'class-validator';
import { normalizeUuid } from '../../../common/ids/uuid';
import { MAX_DIVE_BUDDIES, MAX_OBSERVATIONS } from '../dives.service';
import { DiveWriteBuddyDto } from './dive-write-buddy.dto';
import { DiveWriteEventDto } from './dive-write-event.dto';
import { DiveWriteObservationDto } from './dive-write-observation.dto';
import { DiveWriteParticipationDto } from './dive-write-participation.dto';
import { DiveWriteSiteDto } from './dive-write-site.dto';
import { UniqueBy } from '../../../common/validation/cross-field-rules';
import { IsIsoDateTime, Nullable, Required } from '../../../common/validation/field-rules';

/**
 * Body of `POST /api/dives` and `PUT /api/dives/:id`. Every field is required, `null` only where
 * the contract allows it (D-22). `event.siteId` must equal `site.id` (`requestConsistencyErrors`).
 */
export class DiveWriteRequestDto implements DiveWriteRequest {
  @Required()
  @IsObject()
  @ValidateNested()
  @Type(() => DiveWriteEventDto)
  event: DiveWriteEventDto;

  @Required()
  @IsObject()
  @ValidateNested()
  @Type(() => DiveWriteParticipationDto)
  participation: DiveWriteParticipationDto;

  /** RG-27: 0 to 50, labels unique once trimmed (case kept, like `normalizeObservations`). */
  @Required()
  @IsArray()
  @ArrayMaxSize(MAX_OBSERVATIONS)
  @UniqueBy('label', (label) => label.trim())
  @ValidateNested()
  @Type(() => DiveWriteObservationDto)
  observations: DiveWriteObservationDto[];

  @Required()
  @IsObject()
  @ValidateNested()
  @Type(() => DiveWriteSiteDto)
  site: DiveWriteSiteDto;

  /** 0 to 50 members, each once whatever the case of its id. */
  @Required()
  @IsArray()
  @ArrayMaxSize(MAX_DIVE_BUDDIES)
  @UniqueBy('id', normalizeUuid)
  @ValidateNested()
  @Type(() => DiveWriteBuddyDto)
  buddies: DiveWriteBuddyDto[];

  @Nullable()
  @IsIsoDateTime()
  baseUpdatedAt: string | null;
}
