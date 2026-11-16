import { MapBackdrop } from '@/shared/ui/MapBackdrop';
import { formatCoordinates, spokenCoordinates } from '../../../lib/geo';
import styles from './SiteMiniMap.module.scss';

export interface SiteMiniMapProps {
  latitude: number;
  longitude: number;
}

/**
 * Mini map of one site: the dashboard placeholder backdrop with the marker centred on the site,
 * and its real coordinates. MapLibre will replace the backdrop (design/README.md § 5.3).
 */
export function SiteMiniMap({ latitude, longitude }: SiteMiniMapProps) {
  return (
    <div className={styles.map}>
      <MapBackdrop />
      <span className={styles.marker} aria-hidden="true">
        <span className={styles.dot} />
      </span>
      <p className={styles.coordinates}>
        <span aria-hidden="true">{formatCoordinates(latitude, longitude)}</span>
        <span className={styles.srOnly}>{spokenCoordinates(latitude, longitude)}</span>
      </p>
    </div>
  );
}
