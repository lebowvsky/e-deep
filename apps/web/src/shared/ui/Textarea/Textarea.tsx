import { useId, useLayoutEffect, useRef, type ComponentProps } from 'react';
import { cx } from '@/shared/lib/classNames';
import { formatCharacterCount } from '@/shared/lib/format';
import { fieldBoxState, fieldControlProps, useFormField } from '@/shared/ui/FormField';
import styles from './Textarea.module.scss';

export interface TextareaProps extends Omit<ComponentProps<'textarea'>, 'value' | 'ref'> {
  value: string;
  /** Length from which the character count shows. Default 2 000. */
  counterFrom?: number;
}

/**
 * Multi-line field that grows with its text (min. 120px), no visible limit; a character count
 * appears past `counterFrom` (dive-form.jsx · Notes).
 */
export function Textarea({
  value,
  counterFrom = 2000,
  className,
  readOnly,
  disabled,
  'aria-describedby': ownDescribedBy,
  ...rest
}: TextareaProps) {
  const field = useFormField();
  const counterId = useId();
  const ref = useRef<HTMLTextAreaElement>(null);
  const isReadOnly = readOnly ?? field?.locked;
  const showCounter = value.length > counterFrom;

  // Grows with the content: measures the DOM after each change of value.
  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <div className={cx(styles.root, className)}>
      <div
        className={styles.box}
        {...fieldBoxState(field?.status ?? 'default', Boolean(isReadOnly || disabled))}
      >
        <textarea
          ref={ref}
          className={styles.textarea}
          value={value}
          readOnly={isReadOnly}
          disabled={disabled}
          {...fieldControlProps(field, ownDescribedBy, showCounter && counterId)}
          {...rest}
        />
      </div>
      {showCounter && (
        <p id={counterId} className={styles.counter}>
          {formatCharacterCount(value.length)}
        </p>
      )}
    </div>
  );
}
