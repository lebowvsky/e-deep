import { cx } from '@/shared/lib/classNames';
import styles from './Avatar.module.scss';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  /** Initials shown when there is no picture, e.g. "LB". */
  initials: string;
  /** Picture URL; the avatar stays decorative (the name is shown next to it). */
  src?: string | undefined;
  /** Background colour from the data (buddy accent). Default: the user gradient. */
  color?: string | undefined;
  /** sm 32px · md 36px (default) · lg 40px */
  size?: AvatarSize;
  className?: string | undefined;
}

/** Round avatar with initials. Decorative: always rendered next to the person's name. */
export function Avatar({ initials, src, color, size = 'md', className }: AvatarProps) {
  return (
    <span
      className={cx(styles.avatar, styles[size], !color && styles.gradient, className)}
      // Data-driven colour: the only inline style allowed (see apps/web/CLAUDE.md).
      style={color ? { backgroundColor: color } : undefined}
      aria-hidden="true"
    >
      {src ? <img className={styles.image} src={src} alt="" /> : initials}
    </span>
  );
}
