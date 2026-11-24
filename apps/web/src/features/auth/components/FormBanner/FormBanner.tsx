import type { ReactNode } from 'react';
import { Icon } from '@/shared/ui/Icon';
import styles from './FormBanner.module.scss';

export interface FormBannerProps {
  /** Target of the fields' `aria-describedby` when the banner says what is wrong with them. */
  id?: string;
  children: ReactNode;
}

/**
 * Refusal of a sign-in or sign-up, above the fields (welcome.jsx · LoginForm error): announced as
 * it appears (`role="alert"`). Give it a new `key` per submission so that the same message, met
 * again, is announced again.
 */
export function FormBanner({ id, children }: FormBannerProps) {
  return (
    <div id={id} role="alert" className={styles.banner}>
      <Icon name="alert" size="md" className={styles.icon} />
      <p className={styles.text}>{children}</p>
    </div>
  );
}
