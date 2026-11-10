// DiveLog — display formatters (fr-FR). Keep all number/date formatting here.

/** 5063 → { hours: 84, minutes: 23 } */
export function splitMinutes(totalMinutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/** 5063 → "84 h 23 min" */
export function formatUnderwaterTime(totalMinutes: number): string {
  const { hours, minutes } = splitMinutes(totalMinutes);
  return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
}

/** "2025-09-08T…" → "08 sept. 2025" */
export function formatDiveDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

/**
 * Calendar days between a dive and today: yesterday is 1, whatever the hour.
 *
 * The dive's day is the one written in its ISO date (the API sends the dive's local time with its
 * own offset, D-10), so a 23:30 dive stays on its day. Today is the device's calendar day.
 */
export function calendarDaysSince(iso: string, now: Date = new Date()): number {
  const [year = 1970, month = 1, day = 1] = iso.slice(0, 10).split('-').map(Number);
  const diveDay = Date.UTC(year, month - 1, day);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today - diveDay) / 86_400_000));
}

/** 0 → "Dernière plongée aujourd’hui." · 1 → "Dernière plongée hier." · 14 → "14 jours depuis ta dernière plongée." */
export function formatSinceLastDive(days: number): string {
  if (days === 0) return 'Dernière plongée aujourd’hui.';
  if (days === 1) return 'Dernière plongée hier.';
  return `${formatDayCount(days)} depuis ta dernière plongée.`;
}

/** ("Marine", "Rousseau") → "MR" */
export function formatInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** ("N2", "FFESSM") → "N2 · FFESSM" · ("N1", "OTHER") → "N1 · Autre" · (…, " ") → "N2 FFESSM" */
export function formatDiverLevel(level: string, federation: string, separator = ' · '): string {
  return `${level}${separator}${federation === 'OTHER' ? 'Autre' : federation}`;
}

const headerDate = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const clock = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });
const monthShort = new Intl.DateTimeFormat('fr-FR', { month: 'short' });

/** → "jeu. 22 avr." (uppercased by the overline style) */
export function formatHeaderDate(date: Date): string {
  return headerDate.format(date);
}

/** → "14:08" */
export function formatClock(date: Date): string {
  return clock.format(date);
}

/** Local offset → "UTC+2" (or "UTC" at offset 0). */
export function formatUtcOffset(date: Date): string {
  const minutes = -date.getTimezoneOffset();
  if (minutes === 0) return 'UTC';
  const sign = minutes > 0 ? '+' : '-';
  const hours = Math.floor(Math.abs(minutes) / 60);
  const rest = Math.abs(minutes) % 60;
  return `UTC${sign}${hours}${rest ? `:${rest.toString().padStart(2, '0')}` : ''}`;
}

/** "2025-09-08…" → "sept." */
export function formatMonthShort(iso: string): string {
  return monthShort.format(new Date(iso));
}

/** "2025-09" (calendar month, no time zone involved) → "sept" · "2026-05" → "mai" */
export function formatMonthLabel(yearMonth: string): string {
  const [year = '1970', month = '01'] = yearMonth.split('-');
  // Mid-month at noon UTC: the label never shifts to a neighbour month, whatever the time zone.
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 15, 12));
  return monthShort.format(date).replace(/\.$/, '');
}

/** "août" → "A" (mobile chart axis) */
export function formatMonthInitial(month: string): string {
  return month
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .charAt(0)
    .toUpperCase();
}

/** 1 → "1 jour" · 14 → "14 jours" */
export function formatDayCount(days: number): string {
  return `${days} ${days > 1 ? 'jours' : 'jour'}`;
}

/** ("Lucas", "Bernard") → "L. Bernard" */
export function formatShortName(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}. ${lastName}`;
}

/** ["A", "B", "C"] → "A, B & C" */
export function formatNameList(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} & ${names.at(-1) ?? ''}`;
}

const dayMonth = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' });

/** "2025-09-08T…" → "08 sept." (no year, phone layout) */
export function formatDayMonth(iso: string): string {
  return dayMonth.format(new Date(iso));
}

/** 1 → "1 plongée" · 24 → "24 plongées" */
export function formatDiveCount(count: number): string {
  return `${count} ${count > 1 ? 'plongées' : 'plongée'}`;
}

// ── Dive log ─────────────────────────────────────────────────────────────────────────────────
// A dive date is the local time of the dive with its own offset (« 2026-04-08T10:30:00+02:00 »).
// Its calendar day is the one written in the string, whatever the device time zone (D-10).

/** "2026-04-08T…" → that calendar day at noon UTC, safe to format in any time zone. */
function calendarDay(iso: string): Date {
  const [year = 1970, month = 1, day = 1] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

const diveDayMonth = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'UTC',
});
const weekdayShort = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' });
const monthYear = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const oneDecimal = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** "2026-04-08T10:30:00+02:00" → "08 avr." (the dive's own calendar day) */
export function formatDiveDayMonth(iso: string): string {
  return diveDayMonth.format(calendarDay(iso));
}

/** "2026-04-08T10:30:00+02:00" → "mer." */
export function formatWeekdayShort(iso: string): string {
  return weekdayShort.format(calendarDay(iso));
}

/** "2026-04" → "avril 2026" */
export function formatMonthYear(yearMonth: string): string {
  return monthYear.format(calendarDay(`${yearMonth}-15`));
}

/** "avril 2026" → "Avril 2026" */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** 5063 → "84 h 23" · 44 → "0 h 44" */
export function formatHoursMinutes(totalMinutes: number): string {
  const { hours, minutes } = splitMinutes(totalMinutes);
  return `${hours} h ${minutes.toString().padStart(2, '0')}`;
}

/** 24.598 → "24,6" */
export function formatOneDecimal(value: number): string {
  return oneDecimal.format(value);
}

/** 1 → "1 plongeur différent" · 14 → "14 plongeurs différents" */
export function formatDiverCount(count: number): string {
  return count > 1 ? `${count} plongeurs différents` : `${count} plongeur différent`;
}
