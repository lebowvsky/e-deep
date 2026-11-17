import { Icon } from '@/shared/ui/Icon';
import styles from './DraftBanner.module.scss';

export interface DraftBannerProps {
  /** « Effacer »: back to the values the form opened with. */
  onDiscard: () => void;
}

/** « Brouillon restauré · [Effacer] »: the form reopened with the draft kept on the device. */
export function DraftBanner({ onDiscard }: DraftBannerProps) {
  return (
    <div className={styles.banner}>
      <Icon name="cloud" size="md" className={styles.icon} />
      <p className={styles.text}>Brouillon restauré</p>
      <button type="button" className={styles.discard} onClick={onDiscard}>
        Effacer
        <span className={styles.srOnly}> le brouillon</span>
      </button>
    </div>
  );
}
