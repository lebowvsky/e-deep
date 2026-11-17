import { cx } from '@/shared/lib/classNames';
import { openNativePicker } from '@/shared/lib/nativePicker';
import { TextInput, type TextInputProps } from '@/shared/ui/TextInput';
import styles from './DateInput.module.scss';

export type DateInputProps = Omit<TextInputProps, 'type' | 'font' | 'icon' | 'unit' | 'unitLabel'>;

/**
 * Native `type="date"` (value `YYYY-MM-DD`, shown in the browser's locale) dressed as a field:
 * calendar icon, mono value, picker on click.
 */
export function DateInput({ className, onClick, ...rest }: DateInputProps) {
  return (
    <TextInput
      {...rest}
      type="date"
      font="mono"
      icon="calendar"
      className={cx(styles.native, className)}
      onClick={(event) => {
        onClick?.(event);
        openNativePicker(event);
      }}
    />
  );
}
