import type {
  CurrentStrength,
  DiveWriteEvent,
  EntryType,
  SeaState,
  TimeOfDay,
  Weather,
} from '@e-deep/shared';
import { IsIn, IsUUID, Max, Min } from 'class-validator';
import {
  CURRENT_STRENGTHS,
  ENTRY_TYPES,
  SEA_STATES,
  TIMES_OF_DAY,
  WEATHERS,
} from '../dive-detail-lists';
import {
  IsInteger,
  IsIsoDateTime,
  IsNumeric,
  IsText,
  Nullable,
  Required,
} from './validators/field-rules';

/** Bounds of the `dive_events` CHECKs. */
const UTC_OFFSET_MINUTES = { min: -720, max: 840 } as const;
const AIR_TEMPERATURE_C = { min: -40, max: 60, scale: 1 } as const;
const DIVE_CENTER_LENGTH = { min: 1, max: 120 } as const;

export class DiveWriteEventDto implements DiveWriteEvent {
  @Required()
  @IsUUID('all')
  id: string;

  @Required()
  @IsUUID('all')
  siteId: string;

  @Required()
  @IsIsoDateTime()
  startedAt: string;

  @Required()
  @IsInteger()
  @Min(UTC_OFFSET_MINUTES.min)
  @Max(UTC_OFFSET_MINUTES.max)
  utcOffsetMinutes: number;

  @Nullable()
  @IsIn(ENTRY_TYPES)
  entryType: EntryType | null;

  @Nullable()
  @IsIn(TIMES_OF_DAY)
  timeOfDay: TimeOfDay | null;

  @Nullable()
  @IsIn(WEATHERS)
  weather: Weather | null;

  @Nullable()
  @IsNumeric(AIR_TEMPERATURE_C.scale)
  @Min(AIR_TEMPERATURE_C.min)
  @Max(AIR_TEMPERATURE_C.max)
  airTemperatureC: number | null;

  @Nullable()
  @IsIn(SEA_STATES)
  seaState: SeaState | null;

  @Nullable()
  @IsIn(CURRENT_STRENGTHS)
  currentStrength: CurrentStrength | null;

  @Nullable()
  @IsText(DIVE_CENTER_LENGTH.min, DIVE_CENTER_LENGTH.max)
  diveCenter: string | null;
}
