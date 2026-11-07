import type { ComponentProps } from 'react';
import { cx } from '@/shared/lib/classNames';
import { Icon, type IconName } from '@/shared/ui/Icon';
import styles from './Button.module.scss';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends ComponentProps<'button'> {
  /** `primary` = accent fill, reserved for the main CTA of a screen. Default `secondary`. */
  variant?: ButtonVariant;
  /** md 40px (default) · lg 48px (single hero CTA, e.g. empty state) */
  size?: ButtonSize;
  /** Leading icon (decorative). */
  icon?: IconName;
}

/** Native `<button>` (atoms.jsx · Btn), 40px high; defaults to `type="button"`. */
export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], styles[size], className)}
      {...rest}
    >
      {icon && <Icon name={icon} size="md" />}
      {children}
    </button>
  );
}
