import {
  capitalize,
  formatDiveCount,
  formatHoursMinutes,
  formatMonthYear,
} from '@/shared/lib/format';
import { cx } from '@/shared/lib/classNames';
import { Icon } from '@/shared/ui/Icon';
import { groupByMonth, isGroupedByMonth } from '../../lib/groupByMonth';
import type { DivesSort, DivesSummary, LoggedDive } from '../../types';
import { DiveRow } from '../DiveRow';
import styles from './DivesTable.module.scss';

export interface DivesTableProps {
  dives: readonly LoggedDive[];
  summary: DivesSummary;
  sort: DivesSort;
}

type SortableColumn = 'date' | 'depth' | 'duration';

const SORTED_COLUMN: Record<
  DivesSort,
  { column: SortableColumn; direction: 'ascending' | 'descending' }
> = {
  '-date': { column: 'date', direction: 'descending' },
  date: { column: 'date', direction: 'ascending' },
  '-depth': { column: 'depth', direction: 'descending' },
  '-duration': { column: 'duration', direction: 'descending' },
};

interface Column {
  /** Also the class giving the column width. */
  key: 'number' | 'date' | 'site' | 'depth' | 'duration' | 'temp' | 'gas' | 'team' | 'chevron';
  label: string;
  sortable?: SortableColumn;
  align?: 'right';
  /** Hidden below 1024px (tablet). */
  optional?: boolean;
}

const COLUMNS: Column[] = [
  { key: 'number', label: 'N°' },
  { key: 'date', label: 'Date', sortable: 'date' },
  { key: 'site', label: 'Site' },
  { key: 'depth', label: 'Prof. max', sortable: 'depth', align: 'right' },
  { key: 'duration', label: 'Durée', sortable: 'duration', align: 'right' },
  { key: 'temp', label: 'Temp.', align: 'right', optional: true },
  { key: 'gas', label: 'Gaz', optional: true },
  { key: 'team', label: 'Palanquée' },
  { key: 'chevron', label: '' },
];

/**
 * The dives of the page in a semantic table (dives-list.jsx · TableHead, GroupHeader, Row):
 * one `<tbody>` per month when sorted by date, a flat list otherwise.
 */
export function DivesTable({ dives, summary, sort }: DivesTableProps) {
  const sorted = SORTED_COLUMN[sort];
  const groups = isGroupedByMonth(sort)
    ? groupByMonth(dives, summary.byMonth)
    : [{ month: null, total: null, dives }];

  return (
    <table className={styles.table}>
      <caption className={styles.srOnly}>Plongées du carnet</caption>
      <thead>
        <tr className={styles.head}>
          {COLUMNS.map((column) => {
            const isSorted = column.sortable === sorted.column;
            return (
              <th
                key={column.key}
                scope="col"
                aria-sort={isSorted ? sorted.direction : undefined}
                data-optional={column.optional ? '' : undefined}
                className={cx(
                  styles[column.key],
                  column.align === 'right' && styles.right,
                  isSorted && styles.sorted,
                )}
              >
                {column.label ? (
                  <span className={styles.headLabel}>
                    {column.label}
                    {isSorted && (
                      <Icon
                        name="chevronDown"
                        size="xs"
                        className={cx(
                          styles.sortIcon,
                          sorted.direction === 'ascending' && styles.up,
                        )}
                      />
                    )}
                  </span>
                ) : (
                  <span className={styles.srOnly}>Ouvrir</span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      {groups.map((group) => (
        <tbody key={group.month ?? 'all'}>
          {group.month && group.total && (
            <tr className={styles.group}>
              <th scope="rowgroup" colSpan={COLUMNS.length}>
                <span className={styles.groupInner}>
                  <span className={styles.month}>{capitalize(formatMonthYear(group.month))}</span>
                  <span className={styles.monthTotal}>
                    {formatDiveCount(group.total.count)} · {formatHoursMinutes(group.total.minutes)}
                  </span>
                </span>
              </th>
            </tr>
          )}
          {group.dives.map((dive) => (
            <DiveRow key={dive.id} dive={dive} isPeak={dive.depthMaxM === summary.maxDepthM} />
          ))}
        </tbody>
      ))}
    </table>
  );
}
