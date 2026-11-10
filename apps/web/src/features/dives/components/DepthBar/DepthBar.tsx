import type { CSSProperties } from 'react';
import { cx } from '@/shared/lib/classNames';
import { DEPTH_SCALE_MAX } from '../../types';
import styles from './DepthBar.module.scss';

export interface DepthBarProps {
  depthM: number;
  /** Deepest dive of the selection: the only accent of the rows. */
  isPeak: boolean;
}

/** Mini depth bar on a 0–60 m scale. Decorative: the value is written next to it. */
export function DepthBar({ depthM, isPeak }: DepthBarProps) {
  const ratio = Math.min(depthM / DEPTH_SCALE_MAX, 1);
  // Data-driven length: the only inline style (custom property).
  const fill = { '--depth-ratio': ratio } as CSSProperties;
  return (
    <span className={cx(styles.track, isPeak && styles.peak)} style={fill} aria-hidden="true">
      <span className={styles.fill} />
    </span>
  );
}
