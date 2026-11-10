import { capitalize, formatHoursMinutes, formatMonthYear } from '@/shared/lib/format';
import { groupByMonth, isGroupedByMonth } from '../../lib/groupByMonth';
import type { DivesSort, DivesSummary, LoggedDive } from '../../types';
import { DiveCard } from '../DiveCard';
import styles from './DiveCardList.module.scss';

export interface DiveCardListProps {
  dives: readonly LoggedDive[];
  summary: DivesSummary;
  sort: DivesSort;
}

/** The dives of the page as cards, grouped by month when sorted by date (dives-list.jsx · MobileList). */
export function DiveCardList({ dives, summary, sort }: DiveCardListProps) {
  const isPeak = (dive: LoggedDive) => dive.depthMaxM === summary.maxDepthM;

  if (!isGroupedByMonth(sort)) {
    return (
      <ul className={styles.cards}>
        {dives.map((dive) => (
          <li key={dive.id}>
            <DiveCard dive={dive} isPeak={isPeak(dive)} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className={styles.groups}>
      {groupByMonth(dives, summary.byMonth).map((group) => {
        const month = capitalize(formatMonthYear(group.month));
        return (
          <section key={group.month} aria-label={month}>
            <h2 className={styles.heading}>
              <span className={styles.month}>{month}</span>
              <span className={styles.total}>
                <span aria-hidden="true">
                  {group.total.count} · {formatHoursMinutes(group.total.minutes)}
                </span>
                <span className={styles.srOnly}>
                  {group.total.count} plongées, {formatHoursMinutes(group.total.minutes)}
                </span>
              </span>
            </h2>
            <ul className={styles.cards}>
              {group.dives.map((dive) => (
                <li key={dive.id}>
                  <DiveCard dive={dive} isPeak={isPeak(dive)} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
