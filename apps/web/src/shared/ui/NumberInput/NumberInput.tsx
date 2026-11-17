import { normalizeNumberInput } from '@/shared/lib/numberInput';
import { TextInput, type TextInputProps } from '@/shared/ui/TextInput';

export interface NumberInputProps extends Omit<
  TextInputProps,
  'type' | 'inputMode' | 'value' | 'defaultValue' | 'onChange' | 'font'
> {
  /** Text of the field, French decimal comma included (« 12,5 »): read it with `parseNumberInput`. */
  value: string;
  onValueChange: (value: string) => void;
  /** Accepts one decimal (decimal keypad). Default: whole numbers (numeric keypad). */
  decimal?: boolean;
  /** Accepts a leading minus sign. */
  signed?: boolean;
}

/**
 * Number field without `type="number"` (no wheel nor arrow surprises): numeric or decimal keypad,
 * the dot typed is shown as a French comma, value in mono.
 */
export function NumberInput({
  value,
  onValueChange,
  decimal = false,
  signed = false,
  ...rest
}: NumberInputProps) {
  return (
    <TextInput
      {...rest}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      font="mono"
      value={value}
      onChange={(event) =>
        onValueChange(normalizeNumberInput(event.target.value, { decimal, signed }))
      }
    />
  );
}
