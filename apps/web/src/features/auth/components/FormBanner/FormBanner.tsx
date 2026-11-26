import type { ReactNode, Ref } from 'react';
import { Icon } from '@/shared/ui/Icon';
import styles from './FormBanner.module.scss';

export interface FormBannerProps {
  /** Target of the fields' `aria-describedby` when the banner says what is wrong with them. */
  id?: string;
  /** To move the focus to it (a refusal no field can fix); it is focusable by script only. */
  ref?: Ref<HTMLDivElement>;
  /** What the diver can do about it, after the text (« Réessayer »). */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Refusal of an auth form, above the fields (welcome.jsx · LoginForm error): announced as it
 * appears (`role="alert"`). Give it a new `key` per submission so that the same message, met
 * again, is announced again.
 */
export function FormBanner({ id, ref, action, children }: FormBannerProps) {
  return (
    <div ref={ref} id={id} role="alert" className={styles.banner} tabIndex={-1}>
      <Icon name="alert" size="md" className={styles.icon} />
      <div className={styles.body}>
        <p className={styles.text}>{children}</p>
        {action}
      </div>
    </div>
  );
}
