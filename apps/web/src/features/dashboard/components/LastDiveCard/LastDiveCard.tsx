import { useId } from 'react';
import {
  formatDayMonth,
  formatDiveDate,
  formatInitials,
  formatNameList,
  formatShortName,
} from '@/shared/lib/format';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Overline } from '@/shared/ui/Overline';
import { TextLink } from '@/shared/ui/TextLink';
import { gasLabel } from '../../lib/labels';
import type { Dive, UserLevel } from '../../types';
import { Metric } from '../Metric';
import { ResponsiveText } from '../ResponsiveText';
import styles from './LastDiveCard.module.scss';

export interface LastDiveCardProps {
  dive: Dive;
  level: UserLevel;
}

/** Summary of the most recent dive; « Voir le détail » leads to the logbook (progressive disclosure). */
export function LastDiveCard({ dive, level }: LastDiveCardProps) {
  const titleId = useId();
  const buddyNames = dive.buddies.map((buddy) => formatShortName(buddy.firstName, buddy.lastName));

  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <Overline>Dernière plongée</Overline>
          <h2 id={titleId} className={styles.title}>
            {dive.site.name}
          </h2>
          <p className={styles.place}>
            {dive.site.region} ·{' '}
            <time dateTime={dive.date}>
              <ResponsiveText
                text={{ short: formatDayMonth(dive.date), long: formatDiveDate(dive.date) }}
              />
            </time>
          </p>
        </div>
        <div className={styles.badges}>
          {dive.stopsOk ? (
            <Badge tone="success">
              <ResponsiveText text={{ short: 'OK', long: 'Palier OK' }} />
            </Badge>
          ) : (
            <Badge tone="warning">Paliers à vérifier</Badge>
          )}
          <Badge className={styles.gas}>
            {gasLabel(dive.gasMix)} · {level}
          </Badge>
        </div>
      </header>

      <ul className={styles.metrics} aria-label="Mesures">
        <li>
          <Metric
            label={{ short: 'Prof', long: 'Prof. max' }}
            value={dive.depthMaxM}
            unit="m"
            srText={`Profondeur max ${dive.depthMaxM} mètres`}
          />
        </li>
        <li>
          <Metric
            label="Durée"
            value={dive.durationMin}
            unit="min"
            srText={`Durée ${dive.durationMin} minutes`}
          />
        </li>
        <li>
          <Metric
            label={{ short: 'Temp', long: 'Temp. fond' }}
            value={dive.temperatureC}
            unit={{ short: '°', long: '°C' }}
            srText={`Température au fond ${dive.temperatureC} degrés`}
          />
        </li>
        <li>
          <Metric
            label={{ short: 'Vis', long: 'Visibilité' }}
            value={dive.visibilityM}
            unit="m"
            srText={`Visibilité ${dive.visibilityM} mètres`}
          />
        </li>
      </ul>

      <footer className={styles.footer}>
        {buddyNames.length > 0 && (
          <div className={styles.buddies}>
            <span className={styles.avatars} aria-hidden="true">
              {dive.buddies.map((buddy) => (
                <Avatar
                  key={buddy.id}
                  className={styles.avatar}
                  initials={formatInitials(buddy.firstName, buddy.lastName)}
                  color={buddy.accentColor}
                  size="xs"
                />
              ))}
            </span>
            <p className={styles.with}>
              avec <span className={styles.names}>{formatNameList(buddyNames)}</span>
            </p>
          </div>
        )}
        <TextLink to={`/dives/${dive.id}`} aria-label="Voir le détail de la dernière plongée">
          <ResponsiveText text={{ short: 'Détail', long: 'Voir le détail' }} />
        </TextLink>
      </footer>
    </article>
  );
}
