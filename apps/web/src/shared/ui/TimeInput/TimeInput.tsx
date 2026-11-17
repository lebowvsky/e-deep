import { cx } from '@/shared/lib/classNames';
import { openNativePicker } from '@/shared/lib/nativePicker';
import { TextInput, type TextInputProps } from '@/shared/ui/TextInput';
import styles from './TimeInput.module.scss';

export type TimeInputProps = Omit<TextInputProps, 'type' | 'font' | 'unit' | 'unitLabel'>;

/** Native `type="time"` (value `HH:MM`) dressed as a field: mono value, picker on click. */
export function TimeInput({ className, onClick, ...rest }: TimeInputProps) {
  return (
    <TextInput
      {...rest}
      type="time"
      font="mono"
      className={cx(styles.native, className)}
      onClick={(event) => {
        onClick?.(event);
        openNativePicker(event);
      }}
    />
  );
}
