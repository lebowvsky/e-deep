import { useRef, type KeyboardEvent } from 'react';
import { cx } from '@/shared/lib/classNames';
import { useFormField } from '@/shared/ui/FormField';
import styles from './SegmentedControl.module.scss';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name of the group. Needed outside a `FormField`; inside, the field label names it. */
  label?: string;
  /** compact: 36px, mono 12 (filters) · field: 40px, sans 13 (forms). Default `compact`. */
  variant?: 'compact' | 'field';
  /** Locked choice (e.g. Air ⇒ 21 %): shown, not changeable. Also set by a locked `FormField`. */
  disabled?: boolean;
  className?: string | undefined;
}

const STEP: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/**
 * Single choice among a few options (dives-list.jsx · Période, dive-form.jsx · Segmented): a radio
 * group, one tab stop, arrow keys move and select, Home / End go to the ends.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  variant = 'compact',
  disabled = false,
  className,
}: SegmentedControlProps<T>) {
  const field = useFormField();
  const groupRef = useRef<HTMLDivElement>(null);
  const isDisabled = disabled || Boolean(field?.locked);

  const targetIndex = (key: string, index: number): number | null => {
    if (key === 'Home') return 0;
    if (key === 'End') return options.length - 1;
    const step = STEP[key];
    return step === undefined ? null : (index + step + options.length) % options.length;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    const index = targetIndex(
      event.key,
      options.findIndex((option) => option.value === value),
    );
    const next = index === null ? undefined : options[index];
    if (!next) return;
    event.preventDefault();
    onChange(next.value);
    groupRef.current
      ?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(next.value)}"]`)
      ?.focus();
  };

  return (
    <div
      ref={groupRef}
      id={field?.controlId}
      role="radiogroup"
      aria-label={field ? undefined : label}
      aria-labelledby={field?.labelId}
      aria-describedby={field?.describedBy}
      aria-required={field?.required ? true : undefined}
      aria-disabled={isDisabled ? true : undefined}
      className={cx(styles.group, styles[variant], isDisabled && styles.disabled, className)}
      onKeyDown={onKeyDown}
    >
      {options.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={isDisabled}
            data-value={option.value}
            className={cx(styles.segment, checked && styles.checked)}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
