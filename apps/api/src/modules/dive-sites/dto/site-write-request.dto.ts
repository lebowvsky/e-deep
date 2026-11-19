import type {
  SiteCreateRequest,
  SiteMergeRequest,
  SiteOrigin,
  SiteType,
  SiteWriteRequest,
} from '@e-deep/shared';
import { IsIn, IsPositive, IsUUID, Max, Min } from 'class-validator';
import { AtMostField, PairedWith } from '../../../common/validation/cross-field-rules';
import { IsNumeric, IsText, Nullable, Required } from '../../../common/validation/field-rules';
import { SITE_ORIGINS, SITE_TYPES } from '../site-lists';

// Bounds of the `dive_sites` CHECKs and of the scale of their `numeric` columns.
const TEXT_LENGTH = { min: 1, max: 120 } as const;
const LATITUDE = { min: -90, max: 90 } as const;
const LONGITUDE = { min: -180, max: 180 } as const;
const COORDINATE_SCALE = 6;
const DEPTH_SCALE = 1;
/** H-10, like `max_depth_m`. */
const MAX_DEPTH_M = 350;
const ACCESS_NOTES_LENGTH = { min: 1, max: 2000 } as const;

type SiteWrite = SiteWriteRequestDto;

/**
 * Body of `PUT /api/sites/:id`, every field required, `null` only where the column allows it
 * (D-22). `id` must equal the route id (checked by the controller).
 */
export class SiteWriteRequestDto implements SiteWriteRequest {
  @Required()
  @IsUUID('all')
  id: string;

  @Required()
  @IsText(TEXT_LENGTH.min, TEXT_LENGTH.max)
  name: string;

  @Nullable()
  @IsText(TEXT_LENGTH.min, TEXT_LENGTH.max)
  locality: string | null;

  @Nullable()
  @IsText(TEXT_LENGTH.min, TEXT_LENGTH.max)
  region: string | null;

  @Nullable()
  @IsText(TEXT_LENGTH.min, TEXT_LENGTH.max)
  area: string | null;

  /** A position is both coordinates or none (`ck_dive_sites__position`, D-23). */
  @Nullable()
  @IsNumeric(COORDINATE_SCALE)
  @Min(LATITUDE.min)
  @Max(LATITUDE.max)
  @PairedWith<SiteWrite>('longitude')
  latitude: number | null;

  @Nullable()
  @IsNumeric(COORDINATE_SCALE)
  @Min(LONGITUDE.min)
  @Max(LONGITUDE.max)
  @PairedWith<SiteWrite>('latitude')
  longitude: number | null;

  @Nullable()
  @IsIn(SITE_TYPES)
  type: SiteType | null;

  /** RG-32: at most the maximum depth when both are entered (`ck_dive_sites__depth_range`). */
  @Nullable()
  @IsNumeric(DEPTH_SCALE)
  @Min(0)
  @Max(MAX_DEPTH_M)
  @AtMostField<SiteWrite>('depthMaxM', 'depth-range')
  depthMinM: number | null;

  @Nullable()
  @IsNumeric(DEPTH_SCALE)
  @IsPositive()
  @Max(MAX_DEPTH_M)
  depthMaxM: number | null;

  @Nullable()
  @IsText(ACCESS_NOTES_LENGTH.min, ACCESS_NOTES_LENGTH.max)
  accessNotes: string | null;
}

/** Body of `POST /api/sites`: the origin is only given at creation (RG-34). */
export class SiteCreateRequestDto extends SiteWriteRequestDto implements SiteCreateRequest {
  @Required()
  @IsIn(SITE_ORIGINS)
  createdVia: SiteOrigin;
}

/** Body of `POST /api/sites/:id/merge`. */
export class SiteMergeRequestDto implements SiteMergeRequest {
  @Required()
  @IsUUID('all')
  targetId: string;
}
