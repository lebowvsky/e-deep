import { cx } from '@/shared/lib/classNames';
import styles from './Skeleton.module.scss';

export type SkeletonShape = 'text' | 'block' | 'control';

export interface SkeletonProps {
  /** text 4px radius (default) · block 6px (KPI values, titles) · control 10px (buttons) */
  shape?: SkeletonShape;
  /** Size it from the caller's CSS module, with tokens. */
  className?: string;
}

/**
 * Shimmering placeholder (dashboard-states.jsx · SkelBar). Decorative: put `aria-busy="true"`
 * on the container that is loading.
 */
export function Skeleton({ shape = 'text', className }: SkeletonProps) {
  return <span className={cx(styles.skeleton, styles[shape], className)} aria-hidden="true" />;
}
