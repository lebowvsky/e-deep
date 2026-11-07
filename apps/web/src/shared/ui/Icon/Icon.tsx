import { iconSize } from '@/design/tokens';
import { cx } from '@/shared/lib/classNames';
import { ICON_PATHS, type IconName } from './iconPaths';
import styles from './Icon.module.scss';

export type IconSize = keyof typeof iconSize;

export interface IconProps {
  name: IconName;
  /** sm 14 · md 16 · lg 18 (default) · xl 20 */
  size?: IconSize;
  /** Accessible name. Without it the icon is decorative (`aria-hidden`). */
  label?: string;
  className?: string;
}

/** Stroke icon (1.5px, 24px viewBox) that inherits `currentColor`. */
export function Icon({ name, size = 'lg', label, className }: IconProps) {
  const px = iconSize[size];
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true };

  return (
    <svg
      className={cx(styles.icon, className)}
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...a11y}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
