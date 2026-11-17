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
  /** `null`: nothing chosen yet (optional form answer); the first option takes the tab stop. */
  value: T | null;
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
  const checkedIndex = options.findIndex((option) => option.value === value);

  const targetIndex = (key: string, index: number): number | null => {
    if (key === 'Home') return 0;
    if (key === 'End') return options.length - 1;
    const step = STEP[key];
    if (step === undefined) return null;
    // Nothing chosen yet: the arrows start from either end.
    if (index === -1) return step > 0 ? 0 : options.length - 1;
    return (index + step + options.length) % options.length;
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isDisabled) return;
    const index = targetIndex(event.key, checkedIndex);
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
      {options.map((option, index) => {
        const checked = index === checkedIndex;
        const isTabStop = checked || (checkedIndex === -1 && index === 0);
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={isTabStop ? 0 : -1}
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
