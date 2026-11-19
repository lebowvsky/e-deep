import { Link } from 'react-router';
import { formatDiveCount, formatMeasure } from '@/shared/lib/format';
import { ButtonLink } from '@/shared/ui/Button';
import type { DiveDetailView, DiveLogInsights } from '../../../types';
import { Quantity } from '../../Quantity';
import { DetailSection } from '../DetailSection';
import { FactList } from '../FactList';
import { SiteMiniMap } from '../SiteMiniMap';
import styles from './DiveSiteCard.module.scss';

export interface DiveSiteCardProps {
  site: DiveDetailView['site'];
  /** The user's figures on this site; `null` while the log is unknown. */
  stats: DiveLogInsights['site'] | null;
  className?: string | undefined;
}

/**
 * « Site »: mini map, name (to the site page) and place, then the user's dives and deepest dive
 * there. A site without position offers to place it on the map.
 */
export function DiveSiteCard({ site, stats, className }: DiveSiteCardProps) {
  const id = encodeURIComponent(site.id);
  return (
    <DetailSection title="Site" icon="pin" className={className}>
      <SiteMiniMap position={site.position} />
      {site.position === null && (
        <ButtonLink to={`/map?panel=place&id=${id}`} icon="crosshair" className={styles.toMap}>
          Placer sur la carte
        </ButtonLink>
      )}
      <div className={styles.identity}>
        <h3 className={styles.name}>
          <Link to={`/sites/${id}`} className={styles.link}>
            {site.name}
          </Link>
        </h3>
        {site.place !== null && <p className={styles.place}>{site.place}</p>}
      </div>
      {stats && (
        <FactList
          layout="cells"
          className={styles.stats}
          facts={[
            {
              term: 'Tes plongées ici',
              value: (
                <Quantity
                  size="fact"
                  value={stats.diveCount}
                  srText={formatDiveCount(stats.diveCount)}
                />
              ),
            },
            {
              term: 'Ta prof. max ici',
              value: (
                <Quantity
                  size="fact"
                  value={formatMeasure(stats.maxDepthM)}
                  unit="m"
                  srText={`${formatMeasure(stats.maxDepthM)} mètres`}
                />
              ),
            },
          ]}
        />
      )}
    </DetailSection>
  );
}
