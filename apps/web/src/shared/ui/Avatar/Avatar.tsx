import { cx } from '@/shared/lib/classNames';
import styles from './Avatar.module.scss';

export type AvatarSize = 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
/** color: data colour or user gradient · neutral: the user inside a dive team. */
export type AvatarTone = 'color' | 'neutral';

export interface AvatarProps {
  /** Initials shown when there is no picture, e.g. "LB". */
  initials: string;
  /** Picture URL; the avatar stays decorative (the name is shown next to it). */
  src?: string | undefined;
  /** Background colour from the data (buddy accent). Default: the user gradient. */
  color?: string | undefined;
  /** xxs 24px · xs 26px · sm 32px · md 36px (default) · lg 40px */
  size?: AvatarSize;
  /** `neutral`: surface0 with a strong outline (the user in a dive team). Default `color`. */
  tone?: AvatarTone;
  className?: string | undefined;
}

/**
 * Round avatar with initials. Decorative: always rendered next to the person's name.
 * A parent can draw a ring around it (overlapping avatars) with `--avatar-ring`.
 */
export function Avatar({
  initials,
  src,
  color,
  size = 'md',
  tone = 'color',
  className,
}: AvatarProps) {
  const neutral = tone === 'neutral';
  return (
    <span
      className={cx(
        styles.avatar,
        styles[size],
        neutral ? styles.neutral : !color && styles.gradient,
        className,
      )}
      // Data-driven colour: the only inline style allowed (see apps/web/CLAUDE.md).
      style={color && !neutral ? { backgroundColor: color } : undefined}
      aria-hidden="true"
    >
      {src ? <img className={styles.image} src={src} alt="" /> : initials}
    </span>
  );
}
