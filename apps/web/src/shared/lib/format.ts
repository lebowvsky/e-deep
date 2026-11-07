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
