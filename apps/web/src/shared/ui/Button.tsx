import type { ComponentProps } from 'react';
import { cx } from '@/shared/lib/classNames';
import styles from './Button.module.scss';

/** Native `<button>` with the design-system look; defaults to `type="button"`. */
export function Button({ className, type = 'button', ...rest }: ComponentProps<'button'>) {
  return <button type={type} className={cx(styles.button, className)} {...rest} />;
}
