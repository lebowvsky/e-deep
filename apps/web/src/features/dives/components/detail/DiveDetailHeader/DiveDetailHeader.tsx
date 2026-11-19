import type { EntryType } from '@e-deep/shared';
import type { ReactNode } from 'react';
import { Badge } from '@/shared/ui/Badge';
import { formatDiveLongDate, formatImmersionTime } from '../../../lib/diveTime';
import { ENTRY_TYPE_LABELS, gasMixShort, placeLabel } from '../../../lib/labels';
import type { LoggedDive } from '../../../types';
import styles from './DiveDetailHeader.module.scss';

export interface DiveDetailHeaderProps {
  dive: LoggedDive;
  /** `null` while only the log preview is known (the stops are a detail field). */
  stopsOk: boolean | null;
  /** Sea or area of the site; `null` when not entered or not known yet (log preview). */
  area: string | null;
  /** « Bateau » / « Bord » tag; `null` when not entered or not known yet (log preview). */
  entryType: EntryType | null;
  /** « Modifier ma plongée » and « Dupliquer », once the dive is loaded. */
  actions?: ReactNode;
}

/** Overline (number, date, time), the site as the page h1, place and area, and tags. */
export function DiveDetailHeader({
  dive,
  stopsOk,
  area,
  entryType,
  actions,
}: DiveDetailHeaderProps) {
  const date = formatDiveLongDate(dive.date, dive.utcOffsetMinutes);
  const time = formatImmersionTime(dive.date, dive.utcOffsetMinutes);
  // « Calvi · Corse · Méditerranée », or whatever of the place and area is known.
  const place = placeLabel(dive.site.place, area);

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <p className={styles.overline}>
          <span className={styles.number}>Plongée #{dive.number}</span>
          <span className={styles.dot} aria-hidden="true" />
          <time dateTime={dive.date}>
            {date} · {time}
          </time>
        </p>
        <h1 className={styles.title}>{dive.site.name}</h1>
        <div className={styles.meta}>
          {place !== null && <p className={styles.place}>{place}</p>}
          <ul className={styles.tags} aria-label="Étiquettes">
            {stopsOk !== null && (
              <li>
                {stopsOk ? (
                  <Badge tone="success">Palier OK</Badge>
                ) : (
                  <Badge tone="warning">Paliers à vérifier</Badge>
                )}
              </li>
            )}
            <li>
              <Badge>{gasMixShort(dive.gasMix)}</Badge>
            </li>
            {entryType !== null && (
              <li>
                <Badge>{ENTRY_TYPE_LABELS[entryType]}</Badge>
              </li>
            )}
          </ul>
        </div>
      </div>
      {actions !== undefined && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
