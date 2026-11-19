import { cx } from '@/shared/lib/classNames';
import type { GeoPoint } from '@/shared/model/geo';
import { MapView } from '@/shared/ui/MapView';
import { formatCoordinates, spokenCoordinates } from '../../../lib/geo';
import styles from './SiteMiniMap.module.scss';

/** The site is drawn by the centred marker below, not by the map. */
const NO_SITES = [] as const;

export interface SiteMiniMapProps {
  /** Names the map (« Carte autour de Pointe de la Revellata »). */
  name: string;
  /** `null` when not entered: no map, « Position non renseignée » instead. */
  position: GeoPoint | null;
}

/**
 * Mini map of one site (MapLibre, read only), centred on it: the marker stays in the middle of
 * the map, with the real coordinates over it. Without position, no map is loaded.
 */
export function SiteMiniMap({ name, position }: SiteMiniMapProps) {
  if (position === null) {
    return (
      <div className={cx(styles.map, styles.empty)}>
        {/* Same reading as a missing fact: « — » decorative, then the words (textLow, AA). */}
        <p className={styles.missing}>
          <span className={styles.dash} aria-hidden="true">
            —
          </span>
          Position non renseignée
        </p>
      </div>
    );
  }

  return (
    <div className={styles.map}>
      <MapView
        label={`Carte autour de ${name}`}
        sites={NO_SITES}
        viewport={{ key: `${position.latitude},${position.longitude}`, points: [position] }}
        readOnly
      />
      {/* A read-only map centred on the site: the site is always in the middle. */}
      <span className={styles.marker} aria-hidden="true">
        <span className={styles.dot} />
      </span>
      <p className={styles.coordinates}>
        <span aria-hidden="true">{formatCoordinates(position.latitude, position.longitude)}</span>
        <span className={styles.srOnly}>
          {spokenCoordinates(position.latitude, position.longitude)}
        </span>
      </p>
    </div>
  );
}
