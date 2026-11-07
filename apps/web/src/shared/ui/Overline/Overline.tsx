import type { ReactNode } from 'react';
import { cx } from '@/shared/lib/classNames';
import styles from './Overline.module.scss';

export type OverlineTone = 'low' | 'med' | 'accent';

export interface OverlineProps {
  children: ReactNode;
  /** low (default) · med · accent (section eyebrows only) */
  tone?: OverlineTone;
  as?: 'span' | 'p' | 'h2' | 'h3';
  className?: string | undefined;
}

/** Small uppercase mono label: KPI labels, section eyebrows (atoms.jsx · Overline). */
export function Overline({ children, tone = 'low', as: Tag = 'span', className }: OverlineProps) {
  return <Tag className={cx(styles.overline, styles[tone], className)}>{children}</Tag>;
}
