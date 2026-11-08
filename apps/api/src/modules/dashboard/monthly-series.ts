const MONTHS_IN_SERIES = 12;

/** `YYYY-MM` of the last 12 months, oldest first, the month of `now` (UTC) included. */
export function lastTwelveMonths(now: Date): string[] {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return Array.from({ length: MONTHS_IN_SERIES }, (_unused, index) => {
    const date = new Date(Date.UTC(year, month - (MONTHS_IN_SERIES - 1 - index), 1));
    return `${String(date.getUTCFullYear())}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

/** Completes the counts per month with zeros, in the order of `months`. */
export function fillMonthlySeries(
  months: readonly string[],
  counts: ReadonlyMap<string, number>,
): { month: string; count: number }[] {
  return months.map((month) => ({ month, count: counts.get(month) ?? 0 }));
}

/** First instant of the series, minus a day: dives are bucketed by their *local* month. */
export function seriesLowerBound(now: Date): Date {
  const first = lastTwelveMonths(now)[0] ?? '1970-01';
  return new Date(Date.parse(`${first}-01T00:00:00.000Z`) - 86_400_000);
}
