import type { ComponentProps } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cx } from '@/shared/lib/classNames';
import { Icon, type IconName, type IconSize } from '@/shared/ui/Icon';
import styles from './IconButton.module.scss';

export type IconButtonVariant = 'secondary' | 'ghost';

interface IconButtonOwnProps {
  icon: IconName;
  /** Accessible name — required: the button has no visible text. */
  label: string;
  /** secondary: 40px framed (desktop header) · ghost: 44px bare (mobile top bar, drawer). */
  variant?: IconButtonVariant;
  iconSize?: IconSize;
  /** Accent dot (e.g. unread notifications). Announce it in `label`. */
  dot?: boolean;
  className?: string | undefined;
}

export type IconButtonProps = IconButtonOwnProps &
  Omit<ComponentProps<'button'>, keyof IconButtonOwnProps | 'children' | 'aria-label'>;

export type IconLinkProps = IconButtonOwnProps &
  Omit<LinkProps, keyof IconButtonOwnProps | 'children' | 'aria-label'>;

interface ContentProps {
  icon: IconName;
  iconSize: IconSize;
  dot: boolean;
}

function Content({ icon, iconSize, dot }: ContentProps) {
  return (
    <>
      <Icon name={icon} size={iconSize} />
      {dot && <span className={styles.dot} aria-hidden="true" />}
    </>
  );
}

/** Icon-only `<button>` with a required accessible name. */
export function IconButton({
  icon,
  label,
  variant = 'ghost',
  iconSize = 'lg',
  dot = false,
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx(styles.iconButton, styles[variant], className)}
      {...rest}
    >
      <Content icon={icon} iconSize={iconSize} dot={dot} />
    </button>
  );
}

/** Icon-only router link with a required accessible name. */
export function IconLink({
  icon,
  label,
  variant = 'ghost',
  iconSize = 'lg',
  dot = false,
  className,
  ...rest
}: IconLinkProps) {
  return (
    <Link
      aria-label={label}
      className={cx(styles.iconButton, styles[variant], className)}
      {...rest}
    >
      <Content icon={icon} iconSize={iconSize} dot={dot} />
    </Link>
  );
}
