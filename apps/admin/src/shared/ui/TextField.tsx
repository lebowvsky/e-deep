import { useId, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type TextFieldProps = Omit<ComponentProps<'input'>, 'id'> & {
  label: string;
  /** Said under the label, before the input (format expected). */
  hint?: string | undefined;
  /** Said under the input; marks it invalid. */
  error?: string | null | undefined;
};

/**
 * Labelled text input over the shadcn `Input` and `Label`: the label, the hint and the error are
 * tied to the input (`htmlFor`, `aria-describedby`, `aria-invalid`). Every other prop, `ref` and
 * `className` included, goes to the input.
 */
export function TextField({
  label,
  hint,
  error = null,
  'aria-describedby': describedBy,
  ...inputProps
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedByIds = [hint ? hintId : null, error ? errorId : null, describedBy ?? null]
    .filter((value) => value !== null)
    .join(' ');

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedByIds || undefined}
        {...inputProps}
      />
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
