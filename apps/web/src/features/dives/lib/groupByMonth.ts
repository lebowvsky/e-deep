import type { DivesSort, DivesSummary, LoggedDive, MonthTotal } from '../types';
import { yearMonthOf } from './selectDives';

export interface MonthGroup {
  /** `YYYY-MM` */
  month: string;
  /** Totals of the month on the whole selection, not only on this page. */
  total: MonthTotal;
  dives: LoggedDive[];
}

/** Month groups only make sense when the list is in date order. */
export function isGroupedByMonth(sort: DivesSort): boolean {
  return sort === '-date' || sort === 'date';
}

/** Consecutive dives of the same month, in page order. */
export function groupByMonth(
  dives: readonly LoggedDive[],
  byMonth: DivesSummary['byMonth'],
): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const dive of dives) {
    const month = yearMonthOf(dive.date);
    const last = groups.at(-1);
    if (last?.month === month) {
      last.dives.push(dive);
    } else {
      groups.push({ month, total: byMonth[month] ?? { count: 0, minutes: 0 }, dives: [dive] });
    }
  }
  return groups;
}
