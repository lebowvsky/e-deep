import type { DiveWriteParticipation, GasMix, SuitType, TankMaterial } from '@e-deep/shared';
import { IsBoolean, IsIn, IsPositive, Max, Min } from 'class-validator';
import { SUIT_TYPES, TANK_MATERIALS } from '../dive-detail-lists';
import { GAS_MIXES } from '../gas-mix';
import {
  AtMostField,
  CrossFieldRule,
  LessThanField,
  PairedWith,
} from './validators/cross-field-rules';
import { IsInteger, IsNumeric, IsText, Nullable, Required } from './validators/field-rules';

// Bounds of the `dive_participations` CHECKs (H-10, H-17): "> 0" bounds use `IsPositive`,
// "BETWEEN" bounds `Min`/`Max`. Every `numeric` column of the table has one decimal.
const SCALE = 1;
const MAX_DEPTH_M = 350;
const MAX_DURATION_MIN = 1440;
const WATER_TEMPERATURE_C = { min: -5, max: 45 } as const;
const VISIBILITY_M = { min: 0, max: 100 } as const;
const MAX_NOTES_LENGTH = 5000;
const MAX_SAFETY_STOP_DURATION_MIN = 60;
const MAX_SAFETY_STOP_DEPTH_M = 20;
const MAX_O2_PERCENT = 100;
const MAX_TANK_VOLUME_L = 30;
const PRESSURE_BAR = { min: 0, max: 350 } as const;
const MAX_SUIT_THICKNESS_MM = 15;
const WEIGHT_KG = { min: 0, max: 40 } as const;

type Participation = DiveWriteParticipationDto;

export class DiveWriteParticipationDto implements DiveWriteParticipation {
  @Required()
  @IsNumeric(SCALE)
  @IsPositive()
  @Max(MAX_DEPTH_M)
  maxDepthM: number;

  @Required()
  @IsInteger()
  @IsPositive()
  @Max(MAX_DURATION_MIN)
  durationMin: number;

  @Nullable()
  @IsNumeric(SCALE)
  @Min(WATER_TEMPERATURE_C.min)
  @Max(WATER_TEMPERATURE_C.max)
  waterTemperatureC: number | null;

  @Nullable()
  @IsInteger()
  @Min(VISIBILITY_M.min)
  @Max(VISIBILITY_M.max)
  visibilityM: number | null;

  @Required()
  @IsIn(GAS_MIXES)
  gasMix: GasMix;

  @Required()
  @IsBoolean()
  hasDecompression: boolean;

  @Required()
  @IsBoolean()
  stopsOk: boolean;

  /** `char_length(notes) <= 5000`, untrimmed. */
  @Nullable()
  @IsText(0, MAX_NOTES_LENGTH, { trimmed: false })
  notes: string | null;

  @Nullable()
  @IsNumeric(SCALE)
  @Min(WATER_TEMPERATURE_C.min)
  @Max(WATER_TEMPERATURE_C.max)
  surfaceWaterTemperatureC: number | null;

  /** RG-25: paired with the depth, shorter than the dive. */
  @Nullable()
  @IsInteger()
  @IsPositive()
  @Max(MAX_SAFETY_STOP_DURATION_MIN)
  @PairedWith<Participation>('safetyStopDepthM')
  @LessThanField<Participation>('durationMin', 'before-duration')
  safetyStopDurationMin: number | null;

  /** RG-25: paired with the duration, not deeper than the dive. */
  @Nullable()
  @IsNumeric(SCALE)
  @IsPositive()
  @Max(MAX_SAFETY_STOP_DEPTH_M)
  @PairedWith<Participation>('safetyStopDurationMin')
  @AtMostField<Participation>('maxDepthM', 'above-max-depth')
  safetyStopDepthM: number | null;

  @Nullable()
  @IsBoolean()
  isRepetitive: boolean | null;

  /** RG-23: only for `OTHER`, AIR and NITROX imply their percentage. */
  @Nullable()
  @IsNumeric(SCALE)
  @IsPositive()
  @Max(MAX_O2_PERCENT)
  @CrossFieldRule<Participation>('o2-other-only', (_value, { gasMix }) => gasMix === 'OTHER')
  o2Percent: number | null;

  @Nullable()
  @IsNumeric(SCALE)
  @IsPositive()
  @Max(MAX_TANK_VOLUME_L)
  tankVolumeL: number | null;

  @Nullable()
  @IsIn(TANK_MATERIALS)
  tankMaterial: TankMaterial | null;

  @Nullable()
  @IsInteger()
  @IsPositive()
  @Max(PRESSURE_BAR.max)
  startPressureBar: number | null;

  /** RG-24: at most the start pressure. */
  @Nullable()
  @IsInteger()
  @Min(PRESSURE_BAR.min)
  @Max(PRESSURE_BAR.max)
  @AtMostField<Participation>('startPressureBar', 'above-start-pressure')
  endPressureBar: number | null;

  @Nullable()
  @IsIn(SUIT_TYPES)
  suitType: SuitType | null;

  @Nullable()
  @IsNumeric(SCALE)
  @IsPositive()
  @Max(MAX_SUIT_THICKNESS_MM)
  suitThicknessMm: number | null;

  @Nullable()
  @IsNumeric(SCALE)
  @Min(WEIGHT_KG.min)
  @Max(WEIGHT_KG.max)
  weightKg: number | null;
}
