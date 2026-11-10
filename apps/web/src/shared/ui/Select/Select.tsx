import type { ComponentProps } from 'react';
import { cx } from '@/shared/lib/classNames';
import { Icon, type IconName } from '@/shared/ui/Icon';
import styles from './Select.module.scss';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export interface SelectProps<T extends string> extends Omit<
  ComponentProps<'select'>,
  'value' | 'onChange' | 'children'
> {
  options: readonly SelectOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name (the select usually has no visible label). */
  label: string;
  /** ghost: bare, 40px (sort) · outlined: framed, 32px, mono (page size). Default `ghost`. */
  variant?: 'ghost' | 'outlined';
  /** Leading decorative icon. */
  icon?: IconName;
}

/** Native `<select>` styled as a button: keyboard and screen readers for free, no dependency. */
export function Select<T extends string>({
  options,
  value,
  onChange,
  label,
  variant = 'ghost',
  icon,
  className,
  ...rest
}: SelectProps<T>) {
  return (
    <span className={cx(styles.wrapper, styles[variant], icon && styles.withIcon, className)}>
      {icon && <Icon name={icon} size="md" className={styles.icon} />}
      <select
        className={styles.select}
        value={value}
        aria-label={label}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value);
          if (next) onChange(next.value);
        }}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon name="chevronDown" size="sm" className={styles.chevron} />
    </span>
  );
}
