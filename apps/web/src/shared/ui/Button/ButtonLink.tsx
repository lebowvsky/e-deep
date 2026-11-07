import { Link, type LinkProps } from 'react-router';
import { cx } from '@/shared/lib/classNames';
import { Icon, type IconName } from '@/shared/ui/Icon';
import type { ButtonVariant } from './Button';
import styles from './Button.module.scss';

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  icon?: IconName;
}

/** Router link with the Button look: for actions that navigate (e.g. « Nouvelle plongée »). */
export function ButtonLink({
  variant = 'secondary',
  icon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={cx(styles.button, styles[variant], className)} {...rest}>
      {icon && <Icon name={icon} size="md" />}
      {children}
    </Link>
  );
}
