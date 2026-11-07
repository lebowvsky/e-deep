import {
  daysSince,
  formatClock,
  formatDayCount,
  formatHeaderDate,
  formatUtcOffset,
} from '@/shared/lib/format';
import { ButtonLink } from '@/shared/ui/Button';
import { IconLink } from '@/shared/ui/IconButton';
import styles from './DashboardHeader.module.scss';

export interface DashboardHeaderProps {
  firstName: string;
  /** ISO date of the last dive, or null when there is none yet. */
  lastDiveDate: string | null;
  areaName: string;
  /** Injected for tests; defaults to the current time. */
  now?: Date;
}

/** Page header: date / time / zone, h1, greeting, and (≥ 768px) search, notifications, CTA. */
export function DashboardHeader({
  firstName,
  lastDiveDate,
  areaName,
  now = new Date(),
}: DashboardHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        <p className={styles.meta}>
          <time className={styles.when} dateTime={now.toISOString()}>
            {formatHeaderDate(now)} · {formatClock(now)}
          </time>
          <span className={styles.where}>
            <span className={styles.dot} aria-hidden="true" />
            {areaName} · {formatUtcOffset(now)}
          </span>
        </p>
        <h1 className={styles.title}>Tableau de bord</h1>
        <p className={styles.greeting}>
          Bonjour {firstName}.{' '}
          {lastDiveDate && (
            <span className={styles.since}>
              {formatDayCount(daysSince(lastDiveDate, now))} depuis ta dernière plongée.
            </span>
          )}
        </p>
      </div>
      {/* Below 768px the top bar holds notifications and the FAB holds the CTA. */}
      <div className={styles.actions}>
        <IconLink to="/search" icon="search" iconSize="md" label="Rechercher" variant="secondary" />
        <IconLink
          to="/notifications"
          icon="bell"
          iconSize="md"
          label="Notifications, nouvelles notifications"
          variant="secondary"
          dot
        />
        <ButtonLink to="/dives/new" variant="primary" icon="plus">
          Nouvelle plongée
        </ButtonLink>
      </div>
    </header>
  );
}
