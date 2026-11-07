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

/** Whole days between an ISO date and now. */
export function daysSince(iso: string, now: Date = new Date()): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
}

/** ("Marine", "Rousseau") → "MR" */
export function formatInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

/** ("N2", "FFESSM") → "N2 · FFESSM" · ("N1", "OTHER") → "N1 · Autre" */
export function formatDiverLevel(level: string, federation: string): string {
  return `${level} · ${federation === 'OTHER' ? 'Autre' : federation}`;
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
