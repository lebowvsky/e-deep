import { Button } from '@/shared/ui/Button';
import { Overline } from '@/shared/ui/Overline';
import { formatRegionCount, formatSiteCount, waitingPositionLabel } from '../../lib/labels';
import styles from './MapHeader.module.scss';

export interface MapHeaderProps {
  /** `null` while loading or on error: the counters are not shown. */
  counts: { sites: number; regions: number; waiting: number } | null;
  onAdd: () => void;
}

/** Header of « Mes sites » (sites.jsx · MapHeader): counters, privacy, « Ajouter un site ». */
export function MapHeader({ counts, onAdd }: MapHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        <Overline tone="accent" as="p">
          Carte
          {counts && ` · ${formatSiteCount(counts.sites)} · ${formatRegionCount(counts.regions)}`}
        </Overline>
        <h1 className={styles.title}>Mes sites</h1>
        <p className={styles.subtitle}>
          Tes sites sont privés.
          {counts && counts.waiting > 0 && (
            <span className={styles.waiting}> {waitingPositionLabel(counts.waiting)}</span>
          )}
        </p>
      </div>
      <Button variant="primary" icon="plus" onClick={onAdd} data-add-site className={styles.add}>
        Ajouter un site
      </Button>
    </header>
  );
}
