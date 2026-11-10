import { Link } from 'react-router';
import { cx } from '@/shared/lib/classNames';
import { formatDiveDayMonth, formatWeekdayShort } from '@/shared/lib/format';
import { gasMixShort, gasMixSpoken } from '../../lib/labels';
import type { LoggedDive } from '../../types';
import { Palanquee } from '../Palanquee';
import styles from './DiveCard.module.scss';

export interface DiveCardProps {
  dive: LoggedDive;
  /** Deepest dive of the selection: its depth is the only accent of the card. */
  isPeak: boolean;
}

/** Mobile avatars before « +N ». */
const TEAM_MAX = 4;

/** One dive on phones (dives-list.jsx · DiveCard); the site name links the whole card. */
export function DiveCard({ dive, isPeak }: DiveCardProps) {
  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <p className={styles.meta}>
          #{dive.number} ·{' '}
          <time dateTime={dive.date}>
            {formatWeekdayShort(dive.date)} {formatDiveDayMonth(dive.date)}
          </time>
        </p>
        <Palanquee team={dive.team} max={TEAM_MAX} size="xxs" />
      </div>
      <h3 className={styles.site}>
        <Link to={`/dives/${dive.id}`} className={styles.link}>
          {dive.site.name}
        </Link>
      </h3>
      <p className={styles.place}>{dive.site.place}</p>
      <dl className={styles.measures}>
        <div>
          <dt className={styles.srOnly}>Profondeur max</dt>
          <dd className={cx(styles.value, isPeak && styles.peak)}>
            <span aria-hidden="true">
              {dive.depthMaxM}
              <span className={styles.unit}> m</span>
            </span>
            <span className={styles.srOnly}>{dive.depthMaxM} mètres</span>
          </dd>
        </div>
        <div>
          <dt className={styles.srOnly}>Durée</dt>
          <dd className={styles.value}>
            <span aria-hidden="true">
              {dive.durationMin}
              <span className={styles.unit}> min</span>
            </span>
            <span className={styles.srOnly}>{dive.durationMin} minutes</span>
          </dd>
        </div>
        {dive.temperatureC !== null && (
          <div>
            <dt className={styles.srOnly}>Température</dt>
            <dd className={styles.value}>
              <span aria-hidden="true">
                {dive.temperatureC}
                <span className={styles.unit}> °C</span>
              </span>
              <span className={styles.srOnly}>{dive.temperatureC} degrés</span>
            </dd>
          </div>
        )}
        <div>
          <dt className={styles.srOnly}>Gaz</dt>
          <dd className={styles.gas}>
            <span aria-hidden="true">{gasMixShort(dive.gasMix)}</span>
            <span className={styles.srOnly}>{gasMixSpoken(dive.gasMix)}</span>
          </dd>
        </div>
      </dl>
    </article>
  );
}
