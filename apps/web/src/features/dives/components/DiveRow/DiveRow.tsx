import { Link } from 'react-router';
import { formatDiveDayMonth, formatWeekdayShort } from '@/shared/lib/format';
import { Icon } from '@/shared/ui/Icon';
import { gasMixShort, gasMixSpoken } from '../../lib/labels';
import type { LoggedDive } from '../../types';
import { DepthBar } from '../DepthBar';
import { Palanquee } from '../Palanquee';
import { Quantity } from '../Quantity';
import styles from './DiveRow.module.scss';

export interface DiveRowProps {
  dive: LoggedDive;
  /** Deepest dive of the selection. */
  isPeak: boolean;
}

/** Desktop avatars before « +N ». */
const TEAM_MAX = 5;

/**
 * One dive of the table (dives-list.jsx · Row). The real link is the site name; its hit area
 * covers the whole row, so a click anywhere opens the dive.
 */
export function DiveRow({ dive, isPeak }: DiveRowProps) {
  return (
    <tr className={styles.row}>
      <td className={styles.number}>#{dive.number}</td>
      <td>
        <time className={styles.date} dateTime={dive.date}>
          <span className={styles.day}>{formatDiveDayMonth(dive.date)}</span>
          <span className={styles.weekday}>{formatWeekdayShort(dive.date)}</span>
        </time>
      </td>
      <td className={styles.site}>
        <Link to={`/dives/${dive.id}`} className={styles.link}>
          {dive.site.name}
        </Link>
        <span className={styles.place}>{dive.site.place}</span>
      </td>
      <td>
        <span className={styles.depth}>
          <DepthBar depthM={dive.depthMaxM} isPeak={isPeak} />
          <Quantity
            size="cell"
            value={dive.depthMaxM}
            unit="m"
            srText={`${dive.depthMaxM} mètres`}
            className={styles.depthValue}
          />
        </span>
      </td>
      <td className={styles.numeric}>
        <Quantity
          size="cell"
          value={dive.durationMin}
          unit="min"
          srText={`${dive.durationMin} minutes`}
        />
      </td>
      <td className={styles.numeric}>
        {dive.temperatureC === null ? (
          <Quantity size="cell" value="—" srText="Température non saisie" tone="empty" />
        ) : (
          <Quantity
            size="cell"
            value={dive.temperatureC}
            unit="°C"
            srText={`${dive.temperatureC} degrés`}
            tone="muted"
          />
        )}
      </td>
      <td>
        <span className={dive.gasMix === 'AIR' ? styles.gasAir : styles.gas} aria-hidden="true">
          {gasMixShort(dive.gasMix)}
        </span>
        <span className={styles.srOnly}>{gasMixSpoken(dive.gasMix)}</span>
      </td>
      <td>
        <Palanquee team={dive.team} max={TEAM_MAX} size="xs" />
      </td>
      <td className={styles.chevron}>
        <Icon name="chevronRight" size="md" />
      </td>
    </tr>
  );
}
