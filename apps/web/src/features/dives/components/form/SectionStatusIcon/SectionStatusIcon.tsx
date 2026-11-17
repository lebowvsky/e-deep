import { Icon } from '@/shared/ui/Icon';
import type { SectionStatus } from '../../../form/derived';
import styles from './SectionStatusIcon.module.scss';

export interface SectionStatusIconProps {
  status: SectionStatus['status'];
}

/** ✓ complete · ◐ partial · ○ empty (dive-form.jsx · StatusDot). Decorative: say the state in text. */
export function SectionStatusIcon({ status }: SectionStatusIconProps) {
  return (
    <span className={styles.dot} data-status={status} aria-hidden="true">
      {status === 'complete' && <Icon name="check" size="xs" weight="bold" />}
      {status === 'partial' && (
        <>
          <span className={styles.filled} />
          <span className={styles.half} />
        </>
      )}
    </span>
  );
}
