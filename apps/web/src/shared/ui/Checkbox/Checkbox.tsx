import type { ComponentProps, ReactNode } from 'react';
import { cx } from '@/shared/lib/classNames';
import { Icon } from '@/shared/ui/Icon';
import styles from './Checkbox.module.scss';

export interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type' | 'children'> {
  /** Visible label, on the right; clicking it toggles the box. */
  label: ReactNode;
  /** Class of the row (label and box). */
  className?: string | undefined;
}

/**
 * Native checkbox with its label (welcome.jsx · « Rester connecté »): an 18px box, accent once
 * checked, in a row at least 44px high. Controlled or not, like the `<input>` it wraps.
 */
export function Checkbox({ label, className, ...rest }: CheckboxProps) {
  return (
    <label className={cx(styles.row, className)}>
      <span className={styles.control}>
        <input type="checkbox" className={styles.input} {...rest} />
        <Icon name="check" size="xs" weight="bold" className={styles.mark} />
      </span>
      <span className={styles.label}>{label}</span>
    </label>
  );
}
