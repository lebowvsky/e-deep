import type { HTMLAttributes } from 'react';
import { cx } from '@/shared/lib/classNames';
import styles from './Card.module.scss';

export type CardElevation = 0 | 1 | 2;
export type CardPadding = 'none' | 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** 0 → surface0 · 1 → surface1 (default) · 2 → surface2 */
  elevation?: CardElevation;
  /** none · md 20px (default) · lg 24px */
  padding?: CardPadding;
  as?: 'div' | 'section' | 'article' | 'aside' | 'li';
}

/** Layered surface with hairline border and soft shadow (atoms.jsx · Card). */
export function Card({
  elevation = 1,
  padding = 'md',
  as: Tag = 'div',
  className,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cx(styles.card, styles[`elevation${elevation}`], styles[padding], className)}
      {...rest}
    />
  );
}
