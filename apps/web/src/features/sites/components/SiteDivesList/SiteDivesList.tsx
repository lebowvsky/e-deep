import { Link } from 'react-router';
import { formatDiveDayMonthYear, formatMeasure } from '@/shared/lib/format';
import type { SiteDive } from '@/shared/model/site';
import { Avatar } from '@/shared/ui/Avatar';
import { Icon } from '@/shared/ui/Icon';
import { ResponsiveText } from '@/shared/ui/ResponsiveText';
import { divesHrefOf } from '../../lib/labels';
import styles from './SiteDivesList.module.scss';

export interface SiteDivesListProps {
  siteId: string;
  /** The user's dives here, latest first. */
  dives: readonly SiteDive[];
  /** Initials of the user, first of each dive team. */
  selfInitials: string;
}

/** Rows shown: 5 (3 on phones, by CSS). */
const SHOWN = 5;

const teamLabel = (dive: SiteDive) =>
  dive.buddies.length === 0
    ? 'En solo'
    : `Avec ${dive.buddies.map(({ firstName, lastName }) => `${firstName} ${lastName}`).join(', ')}`;

/**
 * « Tes plongées ici · N » (sites.jsx · DivesHere): the latest dives on the site, each leading to
 * its page; the deepest in accent; « Voir dans Mes plongées » for all of them.
 */
export function SiteDivesList({ siteId, dives, selfInitials }: SiteDivesListProps) {
  const deepest = Math.max(...dives.map(({ depthMaxM }) => depthMaxM));
  return (
    <section className={styles.card} aria-labelledby={`${siteId}-dives`}>
      <div className={styles.head}>
        <h2 id={`${siteId}-dives`} className={styles.title}>
          Tes plongées ici · <span className={styles.count}>{dives.length}</span>
        </h2>
        {dives.length > 0 && (
          <Link to={divesHrefOf(siteId)} className={styles.all}>
            <ResponsiveText text={{ short: 'Tout voir', long: 'Voir dans Mes plongées' }} />
            <Icon name="arrowRight" size="sm" />
          </Link>
        )}
      </div>
      {dives.length === 0 ? (
        <p className={styles.none}>Aucune plongée ici pour l’instant.</p>
      ) : (
        <ul className={styles.rows}>
          {dives.slice(0, SHOWN).map((dive) => (
            <li key={dive.id}>
              <Link to={`/dives/${encodeURIComponent(dive.id)}`} className={styles.row}>
                <span className={styles.number}>#{dive.number}</span>
                <span className={styles.date}>{formatDiveDayMonthYear(dive.date)}</span>
                <span className={dive.depthMaxM === deepest ? styles.deepest : styles.measure}>
                  {formatMeasure(dive.depthMaxM)}
                  <span className={styles.unit}> m</span>
                </span>
                <span className={styles.duration}>
                  {dive.durationMin}
                  <span className={styles.unit}> min</span>
                </span>
                <span className={styles.team}>
                  <span className={styles.srOnly}>{teamLabel(dive)}</span>
                  <span className={styles.avatars} aria-hidden="true">
                    <Avatar initials={selfInitials} size="xxs" tone="neutral" />
                    {dive.buddies.map((buddy) => (
                      <Avatar
                        key={buddy.id}
                        initials={buddy.initials}
                        color={buddy.color}
                        size="xxs"
                      />
                    ))}
                  </span>
                </span>
                <Icon name="chevronRight" size="sm" className={styles.chevron} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
