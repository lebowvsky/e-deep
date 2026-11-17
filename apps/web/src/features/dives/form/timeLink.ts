// Dive form — clock values of the native inputs, and the link between duration and times.
//
// Changing the exit recomputes the duration; changing the duration recomputes the exit. Going past
// midnight is only allowed for a night dive: otherwise the link refuses (returns `null`) and the
// validation reports the exit.
import { formatClockValue } from '@/shared/lib/format';

const MINUTES_PER_DAY = 1440;
const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `HH:MM` (native time input) → minutes since midnight, `null` when empty or malformed. */
export function parseClock(value: string): number | null {
  const match = CLOCK.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** `YYYY-MM-DD` (native date input) → `[year, month, day]`, `null` when not a real day. */
export function parseDay(value: string): [number, number, number] | null {
  const match = DAY.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const isReal =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  return isReal ? [year, month, day] : null;
}

/** The device calendar day of `now`, as a date input value. */
export function toDayValue(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Offset of the device time zone at that wall-clock time, in minutes east of UTC. */
export function deviceUtcOffsetMinutes(day: string, clock: string): number | null {
  const date = parseDay(day);
  const minutes = parseClock(clock);
  if (date === null || minutes === null) return null;
  const [year, month, dayOfMonth] = date;
  const local = new Date(year, month - 1, dayOfMonth, Math.floor(minutes / 60), minutes % 60);
  // `getTimezoneOffset` is west of UTC; `+ 0` turns `-0` into `0`.
  return -local.getTimezoneOffset() + 0;
}

function isoOffset(utcOffsetMinutes: number): string {
  const sign = utcOffsetMinutes < 0 ? '-' : '+';
  const absolute = Math.abs(utcOffsetMinutes);
  const hours = String(Math.floor(absolute / 60)).padStart(2, '0');
  const minutes = String(absolute % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

/** ("2026-04-09", "10:05", 120) → "2026-04-09T10:05:00+02:00" (the API date format, D-10). */
export function toLocalIso(day: string, clock: string, utcOffsetMinutes: number): string | null {
  if (parseDay(day) === null || parseClock(clock) === null) return null;
  return `${day}T${clock}:00${isoOffset(utcOffsetMinutes)}`;
}

/** The dive's own day and clock, as written in its ISO date (D-10). */
export function splitLocalIso(iso: string): { day: string; clock: string } {
  return { day: iso.slice(0, 10), clock: iso.slice(11, 16) };
}

/**
 * Minutes from immersion to exit. An exit at or before the immersion goes past midnight: allowed
 * for a night dive only (`null` otherwise, and for a missing time).
 */
export function durationFromTimes(
  entryTime: string,
  exitTime: string,
  isNight: boolean,
): number | null {
  const entry = parseClock(entryTime);
  const exit = parseClock(exitTime);
  if (entry === null || exit === null) return null;
  const minutes = exit - entry;
  if (minutes > 0) return minutes;
  return isNight ? minutes + MINUTES_PER_DAY : null;
}

/**
 * Exit time after `durationMin`. Past midnight: allowed for a night dive only (`null` otherwise,
 * and for a missing immersion or a duration that is not a positive whole number).
 */
export function exitFromDuration(
  entryTime: string,
  durationMin: number | null,
  isNight: boolean,
): string | null {
  const entry = parseClock(entryTime);
  if (
    entry === null ||
    durationMin === null ||
    !Number.isInteger(durationMin) ||
    durationMin <= 0
  ) {
    return null;
  }
  const end = entry + durationMin;
  if (end >= MINUTES_PER_DAY && !isNight) return null;
  return formatClockValue(end % MINUTES_PER_DAY);
}

/** `h:mm` of the surface interval → minutes, `null` when empty or malformed. */
export function parseInterval(value: string): number | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
