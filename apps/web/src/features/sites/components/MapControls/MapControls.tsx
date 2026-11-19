import { cx } from '@/shared/lib/classNames';
import { Icon } from '@/shared/ui/Icon';
import styles from './MapControls.module.scss';

export interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** « Centrer sur ma position »: asks the browser, on this action only. */
  onLocate: () => void;
  /** Names of places shown on the basemap. */
  showsLabels: boolean;
  onToggleLabels: () => void;
}

/** Controls on the right of the map (sites.jsx · MapControls): zoom, my position, basemap. */
export function MapControls({
  onZoomIn,
  onZoomOut,
  onLocate,
  showsLabels,
  onToggleLabels,
}: MapControlsProps) {
  return (
    <div className={styles.controls}>
      <div className={styles.zoom}>
        <button type="button" className={styles.button} aria-label="Zoomer" onClick={onZoomIn}>
          <Icon name="plus" size="md" />
        </button>
        <button type="button" className={styles.button} aria-label="Dézoomer" onClick={onZoomOut}>
          <Icon name="minus" size="md" />
        </button>
      </div>
      <button
        type="button"
        className={cx(styles.button, styles.single)}
        aria-label="Centrer sur ma position"
        onClick={onLocate}
      >
        <Icon name="locate" size="md" />
      </button>
      <button
        type="button"
        className={cx(styles.button, styles.single)}
        aria-label="Noms de lieux sur la carte"
        aria-pressed={showsLabels}
        onClick={onToggleLabels}
      >
        <Icon name="layers" size="md" />
      </button>
    </div>
  );
}
