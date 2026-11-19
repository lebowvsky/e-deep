import { Icon } from '@/shared/ui/Icon';
import styles from './PositionTag.module.scss';

/** « Position à préciser »: warning colour, with an icon and a text (never colour alone). */
export function PositionTag() {
  return (
    <span className={styles.tag}>
      <Icon name="crosshair" size="xs" weight="bold" />
      Position à préciser
    </span>
  );
}
