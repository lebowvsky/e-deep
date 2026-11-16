import { cx } from '@/shared/lib/classNames';
import styles from './MapBackdrop.module.scss';

export interface MapBackdropProps {
  /** live: map with sites · empty: dimmer backdrop of the empty state */
  variant?: 'live' | 'empty';
}

/** Decorative map background: depth gradient, grid and stylised coastlines (no real geography). */
export function MapBackdrop({ variant = 'live' }: MapBackdropProps) {
  return (
    <div className={cx(styles.backdrop, styles[variant])} aria-hidden="true">
      <div className={styles.grid} />
      <svg
        className={styles.coasts}
        viewBox="0 0 1000 440"
        preserveAspectRatio="none"
        focusable="false"
      >
        <path
          className={styles.coast}
          vectorEffect="non-scaling-stroke"
          d="M0 150 Q 120 130, 220 170 T 420 180 Q 480 190, 560 170 T 760 200 Q 840 220, 1000 210"
        />
        <path
          className={styles.coastDim}
          vectorEffect="non-scaling-stroke"
          d="M0 230 Q 160 210, 260 240 T 500 260 Q 600 270, 700 250 T 1000 280"
        />
        {variant === 'live' && (
          <path
            className={styles.coastFaint}
            vectorEffect="non-scaling-stroke"
            d="M150 340 Q 280 320, 380 350 T 620 360 Q 720 370, 820 350"
          />
        )}
      </svg>
    </div>
  );
}
