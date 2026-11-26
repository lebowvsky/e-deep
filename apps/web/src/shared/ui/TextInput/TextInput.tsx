import { useId, type ComponentProps, type ReactNode } from 'react';
import { cx } from '@/shared/lib/classNames';
import { fieldBoxState, fieldControlProps, useFormField } from '@/shared/ui/FormField';
import { Icon, type IconName } from '@/shared/ui/Icon';
import styles from './TextInput.module.scss';

export interface TextInputProps extends Omit<ComponentProps<'input'>, 'size'> {
  /** Unit suffix in mono `textLow` (« m », « bar »). Hidden from screen readers: see `unitLabel`. */
  unit?: string;
  /** Spoken unit (« mètres »), added to the description of the control. */
  unitLabel?: string;
  /** Leading decorative icon. */
  icon?: IconName;
  /** Extra content at the end of the box (e.g. the region of the chosen site). */
  end?: ReactNode;
  /** Typeface of the value: `mono` for numbers, dates and times. Default `sans`. */
  font?: 'sans' | 'mono';
  /** md 44px (forms of the app, default) · lg 48px (sign-in and sign-up, welcome.jsx). */
  size?: 'md' | 'lg';
  /** Class of the box (the `<input>` itself takes no class). */
  className?: string | undefined;
}

/**
 * Text field in its frame (dive-form.jsx · Input), 44px: icon, value, unit suffix, and the error
 * icon. State (warning, error, locked) and ARIA wiring come from the enclosing `FormField`.
 */
export function TextInput({
  unit,
  unitLabel,
  icon,
  end,
  font = 'sans',
  size = 'md',
  className,
  type = 'text',
  readOnly,
  disabled,
  'aria-describedby': ownDescribedBy,
  ...rest
}: TextInputProps) {
  const field = useFormField();
  const unitLabelId = useId();
  const status = field?.status ?? 'default';
  const isReadOnly = readOnly ?? field?.locked;
  const control = fieldControlProps(field, ownDescribedBy, unitLabel && unitLabelId);

  return (
    <div
      className={cx(styles.box, styles[font], size === 'lg' && styles.lg, className)}
      {...fieldBoxState(status, Boolean(isReadOnly || disabled))}
    >
      {icon && <Icon name={icon} size="md" className={styles.icon} />}
      <input
        type={type}
        className={styles.input}
        readOnly={isReadOnly}
        disabled={disabled}
        {...control}
        {...rest}
      />
      {end}
      {unit && (
        <span className={styles.unit} aria-hidden="true">
          {unit}
        </span>
      )}
      {unitLabel && (
        <span id={unitLabelId} className={styles.srOnly}>
          {unitLabel}
        </span>
      )}
      {status === 'error' && <Icon name="alert" size="md" className={styles.errorIcon} />}
    </div>
  );
}
