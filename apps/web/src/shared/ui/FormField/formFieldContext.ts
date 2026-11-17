import { createContext, use } from 'react';

/** `error` blocks the save and sets `aria-invalid`; `warning` only informs (non-blocking). */
export type FieldStatus = 'default' | 'warning' | 'error';

export interface FormFieldContextValue {
  /** Id of the control: target of the label and of the error summary links. */
  controlId: string;
  /** Id of the visible label, for controls a `<label for>` cannot name (radio group). */
  labelId: string;
  /** Id of the help or message shown under the control. */
  describedBy: string | undefined;
  status: FieldStatus;
  required: boolean;
  /** Read-only field (e.g. shared event data the user cannot edit), shown with its help. */
  locked: boolean;
}

export const FormFieldContext = createContext<FormFieldContextValue | null>(null);

/** Wiring of the enclosing `FormField`, or `null` for a control used on its own. */
export function useFormField(): FormFieldContextValue | null {
  return use(FormFieldContext);
}

/** Joins the defined ids of an `aria-describedby` / `aria-labelledby`. */
export function joinIds(...ids: (string | false | null | undefined)[]): string | undefined {
  const joined = ids.filter(Boolean).join(' ');
  return joined === '' ? undefined : joined;
}

export interface FieldControlProps {
  id: string | undefined;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
  'aria-required': true | undefined;
}

/**
 * ARIA wiring for the control of a field, with the control's own descriptions appended (unit,
 * counter). Without a field, only the own descriptions remain.
 */
export function fieldControlProps(
  field: FormFieldContextValue | null,
  ...ownDescriptions: (string | false | null | undefined)[]
): FieldControlProps {
  return {
    id: field?.controlId,
    'aria-describedby': joinIds(field?.describedBy, ...ownDescriptions),
    'aria-invalid': field?.status === 'error' ? true : undefined,
    'aria-required': field?.required ? true : undefined,
  };
}

/** `data-*` attributes read by the `field-box` mixin. */
export function fieldBoxState(status: FieldStatus, locked: boolean) {
  return {
    'data-status': status === 'default' ? undefined : status,
    'data-locked': locked ? '' : undefined,
  };
}
