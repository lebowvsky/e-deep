import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import styles from './PrefillBanner.module.scss';

export interface PrefillBannerProps {
  /**
   * suggestion: a new dive, the latest one is less than 48 h old (« Reprendre ») · duplicate: the
   * form was filled from that dive (« Repartir de zéro »).
   */
  variant: 'suggestion' | 'duplicate';
  /** Logbook number of the source dive. */
  number: number;
  /** Site of the source dive, named by the duplicate banner. */
  siteName: string;
  onAction: () => void;
}

/** What the form takes from another dive (dive-form.jsx · bandeau préremplissage). */
export function PrefillBanner({ variant, number, siteName, onAction }: PrefillBannerProps) {
  if (variant === 'suggestion') {
    return (
      <div className={styles.banner} data-variant={variant}>
        <Icon name="copy" size="md" className={styles.icon} />
        <p className={styles.text}>
          Reprendre la palanquée, l’équipement et les conditions de{' '}
          <span className={styles.number}>#{number}</span> ?
        </p>
        <Button className={styles.action} onClick={onAction}>
          Reprendre
        </Button>
      </div>
    );
  }
  return (
    <div className={styles.banner} data-variant={variant}>
      <Icon name="copy" size="md" className={styles.icon} />
      <p className={styles.text}>
        Prérempli depuis <span className={styles.number}>#{number}</span> · {siteName}
        <span className={styles.secondary}> — palanquée, équipement et conditions repris.</span>
      </p>
      <button type="button" className={styles.textButton} onClick={onAction}>
        Repartir de zéro
      </button>
    </div>
  );
}
