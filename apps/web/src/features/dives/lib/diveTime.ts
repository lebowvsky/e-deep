// Dive detail — dates and times of a dive, in the dive's own local time (D-10).
//
// The API sends the start instant with the offset of the place (`utcOffsetMinutes`). Shifting the
// instant by that offset and formatting it in UTC gives the wall clock of the dive site, whatever
// the device time zone: a dive at 14:20 in Calvi reads 14:20 everywhere.
const MS_PER_MINUTE = 60_000;

const longDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const clock = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

/** The dive-site wall clock, `minutesLater` after the start, as a Date read in UTC. */
function siteWallClock(iso: string, utcOffsetMinutes: number, minutesLater = 0): Date {
  return new Date(Date.parse(iso) + (utcOffsetMinutes + minutesLater) * MS_PER_MINUTE);
}

/** ("2026-04-08T12:20:00Z", 120) → "mer. 08 avr. 2026" */
export function formatDiveLongDate(iso: string, utcOffsetMinutes: number): string {
  return longDate.format(siteWallClock(iso, utcOffsetMinutes));
}

/** Immersion: ("2026-04-08T12:20:00Z", 120) → "14:20" */
export function formatImmersionTime(iso: string, utcOffsetMinutes: number): string {
  return clock.format(siteWallClock(iso, utcOffsetMinutes));
}

/** Surfacing, start + duration: ("2026-04-08T12:20:00Z", 120, 38) → "14:58" */
export function formatExitTime(iso: string, utcOffsetMinutes: number, durationMin: number): string {
  return clock.format(siteWallClock(iso, utcOffsetMinutes, durationMin));
}

// ── Technical instants (creation, latest change) ─────────────────────────────────────────────
// Not a time of the dive: they are read in the device time zone, not the dive's offset.

/** `timeZone`: the device one by default (a fixed one in tests). */
function dayFormats(timeZone: string | undefined) {
  return {
    day: new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone,
    }),
    dayMonth: new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', timeZone }),
    key: new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone,
    }),
  };
}

const deviceDayFormats = dayFormats(undefined);

export interface RecordDates {
  /** « 08 avr. 2026 » */
  created: string;
  /** « 09 avr. » (the year only when it differs), `null` when changed on the creation day. */
  modified: string | null;
}

/** « Créée le 08 avr. 2026 · modifiée le 09 avr. »: the days of both instants, in the device zone. */
export function formatRecordDates(
  createdAt: string,
  updatedAt: string,
  timeZone?: string,
): RecordDates {
  const formats = timeZone === undefined ? deviceDayFormats : dayFormats(timeZone);
  const created = new Date(createdAt);
  const updated = new Date(updatedAt);
  const createdDay = formats.key.format(created);
  const updatedDay = formats.key.format(updated);
  const sameYear = createdDay.slice(0, 4) === updatedDay.slice(0, 4);
  return {
    created: formats.day.format(created),
    modified:
      updatedDay === createdDay
        ? null
        : (sameYear ? formats.dayMonth : formats.day).format(updated),
  };
}
