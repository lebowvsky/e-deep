import { Badge } from '@/shared/ui/Badge';
import { formatDiveLongDate, formatImmersionTime } from '../../../lib/diveTime';
import { gasMixShort } from '../../../lib/labels';
import type { LoggedDive } from '../../../types';
import styles from './DiveDetailHeader.module.scss';

export interface DiveDetailHeaderProps {
  dive: LoggedDive;
  /** `null` while only the log preview is known (the stops are a detail field). */
  stopsOk: boolean | null;
}

/** Overline (number, date, time), the site as the page h1, place and tags. */
export function DiveDetailHeader({ dive, stopsOk }: DiveDetailHeaderProps) {
  const date = formatDiveLongDate(dive.date, dive.utcOffsetMinutes);
  const time = formatImmersionTime(dive.date, dive.utcOffsetMinutes);

  return (
    <header className={styles.header}>
      <p className={styles.overline}>
        <span className={styles.number}>Plongée #{dive.number}</span>
        <span className={styles.dot} aria-hidden="true" />
        <time dateTime={dive.date}>
          {date} · {time}
        </time>
      </p>
      <h1 className={styles.title}>{dive.site.name}</h1>
      <div className={styles.meta}>
        <p className={styles.place}>{dive.site.place}</p>
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
        </ul>
      </div>
    </header>
  );
}
