import { iconSize, iconStroke } from '@/design/tokens';
import { cx } from '@/shared/lib/classNames';
import { ICON_PATHS, type IconName } from './iconPaths';
import styles from './Icon.module.scss';

export type IconSize = keyof typeof iconSize;
export type IconWeight = Exclude<keyof typeof iconStroke, 'brand'>;

export interface IconProps {
  name: IconName;
  /** sm 14 · md 16 · lg 18 (default) · xl 20 · xxl 22 */
  size?: IconSize;
  /** Stroke: regular 1.5 (default) · bold 2.2 */
  weight?: IconWeight;
  /** Accessible name. Without it the icon is decorative (`aria-hidden`). */
  label?: string;
  className?: string | undefined;
}

/** Stroke icon (1.5px, 24px viewBox) that inherits `currentColor`. */
export function Icon({ name, size = 'lg', weight = 'regular', label, className }: IconProps) {
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
      strokeWidth={iconStroke[weight]}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...a11y}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
