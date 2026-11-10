import type { UserLevel, Federation } from '@e-deep/shared';
import {
  formatDiveCount,
  formatDiverCount,
  formatDiverLevel,
  formatMonthYear,
} from '@/shared/lib/format';
import { Button, ButtonLink } from '@/shared/ui/Button';
import { Overline } from '@/shared/ui/Overline';
import { yearMonthOf } from '../../lib/selectDives';
import type { DiveLogOverview } from '../../types';
import styles from './DivesHeader.module.scss';

export interface DivesHeaderProps {
  level: UserLevel;
  federation: Federation;
  /** Whole log; `null` hides the subtitle (empty log). */
  log: DiveLogOverview | null;
  onExport: () => void;
}

/** Page header: eyebrow, h1, log subtitle, Export and New dive (≥ 768px; FAB below). */
export function DivesHeader({ level, federation, log, onExport }: DivesHeaderProps) {
  const firstDive = log?.firstDiveDate;
  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        <Overline tone="accent" as="p" className={styles.eyebrow}>
          <span className={styles.eyebrowLong}>
            Carnet de plongée · {formatDiverLevel(level, federation, ' ')}
          </span>
          {log && (
            <span className={styles.eyebrowShort}>Carnet · {formatDiveCount(log.totalDives)}</span>
          )}
        </Overline>
        <h1 className={styles.title}>Mes plongées</h1>
        {log && firstDive && (
          <p className={styles.subtitle}>
            {formatDiveCount(log.totalDives)} depuis {formatMonthYear(yearMonthOf(firstDive))}.{' '}
            <span className={styles.divers}>Avec {formatDiverCount(log.diverCount)}.</span>
          </p>
        )}
      </div>
      <div className={styles.actions}>
        <Button icon="download" onClick={onExport}>
          Exporter
        </Button>
        <ButtonLink to="/dives/new" variant="primary" icon="plus">
          Nouvelle plongée
        </ButtonLink>
      </div>
    </header>
  );
}
