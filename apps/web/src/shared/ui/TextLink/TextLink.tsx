import { Link, type LinkProps } from 'react-router';
import { cx } from '@/shared/lib/classNames';
import { Icon } from '@/shared/ui/Icon';
import styles from './TextLink.module.scss';

export interface TextLinkProps extends LinkProps {
  /** Trailing arrow (« Voir le détail → »). Default true. */
  arrow?: boolean;
}

/** Accent text link for secondary navigation inside cards (« Voir tous », « Voir le détail »). */
export function TextLink({ arrow = true, className, children, ...rest }: TextLinkProps) {
  return (
    <Link className={cx(styles.link, className)} {...rest}>
      {children}
      {arrow && <Icon name="arrowRight" size="sm" />}
    </Link>
  );
}
