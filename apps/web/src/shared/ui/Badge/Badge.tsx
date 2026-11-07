import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/classNames';
import styles from './Badge.module.scss';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  children: ReactNode;
  /** neutral (default) · accent (level / active) · success · warning · danger */
  tone?: BadgeTone;
  /** Leading status dot. */
  dot?: boolean;
  className?: string | undefined;
}

/** Mono pill chip (visual-direction.jsx · Chips & badges). */
export function Badge({ children, tone = 'neutral', dot = false, className }: BadgeProps) {
  return (
    <span className={cx(styles.badge, styles[tone], className)}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
