import type { ComponentProps } from 'react';
import { cx } from '@/shared/lib/classNames';
import { fieldBoxState, fieldControlProps, useFormField } from '@/shared/ui/FormField';
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
  /** Accessible name. Needed outside a `FormField`; inside, the field label names it. */
  label?: string;
  /**
   * ghost: bare, 40px (sort) · outlined: framed, 32px, mono (page size) · field: 44px form field
   * (dive-form.jsx · Météo), state and ARIA from the enclosing `FormField`. Default `ghost`.
   */
  variant?: 'ghost' | 'outlined' | 'field';
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
  disabled,
  'aria-describedby': ownDescribedBy,
  ...rest
}: SelectProps<T>) {
  const field = useFormField();
  const isLocked = Boolean(disabled || field?.locked);
  return (
    <span
      className={cx(styles.wrapper, styles[variant], icon && styles.withIcon, className)}
      {...(variant === 'field' ? fieldBoxState(field?.status ?? 'default', isLocked) : {})}
    >
      {icon && <Icon name={icon} size="md" className={styles.icon} />}
      <select
        className={styles.select}
        value={value}
        aria-label={field ? undefined : label}
        // A native select has no read-only state: a locked field is disabled.
        disabled={isLocked}
        {...fieldControlProps(field, ownDescribedBy)}
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
