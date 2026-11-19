import { applyDecorators } from '@nestjs/common';
import { IsDefined, IsInt, IsNumber, IsString, ValidateBy, ValidateIf } from 'class-validator';

// Single-field rules of the write DTOs. Each one mirrors a database constraint exactly, so that no
// value can reach a `CHECK` (D-26). Custom constraints are named after their contract code.

/** Present and not `null` (D-22: every field is required). */
export function Required(): PropertyDecorator {
  return IsDefined();
}

/** Present, `null` allowed (= not entered, D-22); the other rules only apply to a value. */
export function Nullable(): PropertyDecorator {
  return applyDecorators(
    IsDefined(),
    ValidateIf((_object: object, value: unknown) => value !== null),
  );
}

/** A number (`type` otherwise) without decimals (`integer`), for the `smallint` columns. */
export function IsInteger(): PropertyDecorator {
  return applyDecorators(IsNumber({ allowNaN: false, allowInfinity: false }), IsInt());
}

/**
 * A finite number with at most `scale` decimals, the scale of its `numeric` column: a value with
 * more decimals is refused rather than silently rounded by PostgreSQL.
 */
export function IsNumeric(scale: number): PropertyDecorator {
  return applyDecorators(
    IsNumber({ allowNaN: false, allowInfinity: false }),
    ValidateBy({
      name: 'precision',
      constraints: [scale],
      validator: {
        validate: (value: unknown) =>
          typeof value !== 'number' || Number(value.toFixed(scale)) === value,
      },
    }),
  );
}

/**
 * Text measured like its `CHECK`: in characters (code points, as `char_length`), after `btrim`
 * when `trimmed` (which strips spaces only). A text blank once trimmed by `String#trim` is refused
 * too: the observation labels are stored trimmed that way. `NUL` cannot be stored in a `text`.
 */
export function IsText(min: number, max: number, { trimmed = true } = {}): PropertyDecorator {
  return applyDecorators(
    IsString(),
    ValidateBy({
      name: 'invalid-character',
      validator: { validate: (value: unknown) => !isString(value) || !value.includes('\u0000') },
    }),
    ValidateBy({
      name: 'length',
      constraints: [min, max],
      validator: {
        validate: (value: unknown) => !isString(value) || isWithinLength(value, min, max, trimmed),
      },
    }),
  );
}

function isWithinLength(value: string, min: number, max: number, trimmed: boolean): boolean {
  if (trimmed && min > 0 && value.trim() === '') {
    return false;
  }
  const length = [...(trimmed ? postgresBtrim(value) : value)].length;
  return length >= min && length <= max;
}

/** `btrim(x)` of PostgreSQL: spaces only, unlike `String#trim`. */
function postgresBtrim(value: string): string {
  return value.replace(/^ +| +$/g, '');
}

/** `2026-04-09T10:05:00+02:00`: seconds required, milliseconds at most, explicit offset or `Z`. */
const ISO_DATE_TIME =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?<offset>Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

const MS_PER_MINUTE = 60_000;
const WALL_CLOCK_LENGTH = 'YYYY-MM-DDTHH:mm:ss'.length;

/**
 * An instant in ISO 8601 with an explicit offset and a real calendar date and time (no 30
 * February, no 24:00): shifting the instant back by its offset must give the same wall clock. A
 * `Date` keeps milliseconds only: more digits would be rounded silently.
 */
export function isIsoDateTime(value: unknown): boolean {
  if (!isString(value)) {
    return false;
  }
  const offset = ISO_DATE_TIME.exec(value)?.groups?.['offset'];
  const instant = Date.parse(value);
  if (offset === undefined || Number.isNaN(instant)) {
    return false;
  }
  const wallClock = new Date(instant + offsetMinutes(offset) * MS_PER_MINUTE).toISOString();
  return wallClock.slice(0, WALL_CLOCK_LENGTH) === value.slice(0, WALL_CLOCK_LENGTH);
}

/** Offset written in a valid `isIsoDateTime` value, in minutes; `null` for any other value. */
export function isoOffsetMinutes(value: unknown): number | null {
  if (!isIsoDateTime(value) || !isString(value)) {
    return null;
  }
  const offset = ISO_DATE_TIME.exec(value)?.groups?.['offset'];
  return offset === undefined ? null : offsetMinutes(offset);
}

/** `Z` → 0, `+05:30` → 330, `-03:00` → -180. */
function offsetMinutes(offset: string): number {
  if (offset === 'Z') {
    return 0;
  }
  const sign = offset.startsWith('-') ? -1 : 1;
  const [hours = 0, minutes = 0] = offset.slice(1).split(':').map(Number);
  return sign * (hours * 60 + minutes);
}

export function IsIsoDateTime(): PropertyDecorator {
  return ValidateBy({ name: 'date-time', validator: { validate: isIsoDateTime } });
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
