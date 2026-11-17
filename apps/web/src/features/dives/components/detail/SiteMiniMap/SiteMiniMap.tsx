import { MapBackdrop } from '@/shared/ui/MapBackdrop';
import { formatCoordinates, spokenCoordinates } from '../../../lib/geo';
import type { GeoPoint } from '../../../types';
import styles from './SiteMiniMap.module.scss';

export interface SiteMiniMapProps {
  /** `null` when not entered: no marker, « Position non renseignée » instead of coordinates. */
  position: GeoPoint | null;
}

/**
 * Mini map of one site: the dashboard placeholder backdrop with the marker centred on the site,
 * and its real coordinates. MapLibre will replace the backdrop (design/README.md § 5.3).
 */
export function SiteMiniMap({ position }: SiteMiniMapProps) {
  return (
    <div className={styles.map}>
      <MapBackdrop />
      {position === null ? (
        // Same reading as a missing fact: « — » decorative, then the words (textLow, AA).
        <p className={styles.missing}>
          <span className={styles.dash} aria-hidden="true">
            —
          </span>
          Position non renseignée
        </p>
      ) : (
        <>
          <span className={styles.marker} aria-hidden="true">
            <span className={styles.dot} />
          </span>
          <p className={styles.coordinates}>
            <span aria-hidden="true">
              {formatCoordinates(position.latitude, position.longitude)}
            </span>
            <span className={styles.srOnly}>
              {spokenCoordinates(position.latitude, position.longitude)}
            </span>
          </p>
        </>
      )}
    </div>
  );
}
