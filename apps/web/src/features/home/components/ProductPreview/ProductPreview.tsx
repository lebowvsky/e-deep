import { APP_NAME } from '@/shared/config/app';
import { LANDING_ANCHORS } from '../../content';
import styles from './ProductPreview.module.scss';

/** Captures of the app (`public/marketing/`, from `/dashboard?state=ready` at 1440 and 375, @2x). */
const DESKTOP = {
  src: '/marketing/dashboard-desktop.webp',
  x2: '/marketing/dashboard-desktop@2x.webp',
  width: 950,
  height: 567,
} as const;
const PHONE = {
  src: '/marketing/dashboard-mobile.webp',
  x2: '/marketing/dashboard-mobile@2x.webp',
  width: 270,
  height: 518,
} as const;

/**
 * The product, shown by images rather than by the dashboard's components (accueil.md: the public
 * bundle stays light, no fake data to keep up): a browser frame and a phone overlapping it on
 * desktop, the phone alone below. The frames are CSS and decorative; the images are lazy and sized.
 */
export function ProductPreview() {
  return (
    <section id={LANDING_ANCHORS.preview} className={styles.preview} aria-label="Aperçu de l’app">
      <div className={styles.browser}>
        <div className={styles.bar} aria-hidden="true">
          <span className={styles.dot} />
          <span className={styles.dot} />
          <span className={styles.dot} />
        </div>
        <img
          className={styles.image}
          src={DESKTOP.src}
          srcSet={`${DESKTOP.src} 1x, ${DESKTOP.x2} 2x`}
          width={DESKTOP.width}
          height={DESKTOP.height}
          loading="lazy"
          decoding="async"
          alt={`Tableau de bord ${APP_NAME} sur ordinateur : 127 plongées, 84 heures sous l’eau, profondeur max 42 m, carte des sites`}
        />
      </div>
      <div className={styles.phone}>
        <img
          className={styles.image}
          src={PHONE.src}
          srcSet={`${PHONE.src} 1x, ${PHONE.x2} 2x`}
          width={PHONE.width}
          height={PHONE.height}
          loading="lazy"
          decoding="async"
          alt={`Tableau de bord ${APP_NAME} sur téléphone : chiffres clés et carte des sites`}
        />
      </div>
    </section>
  );
}
