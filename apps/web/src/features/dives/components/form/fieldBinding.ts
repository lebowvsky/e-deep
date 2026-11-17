// Dive form — wiring of a field of `useDiveForm` to the `shared/ui` controls: one place for the
// id targeted by the error summary, the messages, the « * » and the lock of the shared event.
import type { ChangeEvent, ReactNode } from 'react';
import { capitalize } from '@/shared/lib/format';
import type { DiveForm } from '../../form/useDiveForm';
import {
  isFieldEditable,
  REQUIRED_FIELDS,
  type DiveFormField,
  type DiveFormSection,
  type DiveFormValues,
} from '../../form/model';

/** Help of an event field the diver cannot edit (`canEditEvent` false). */
export const LOCKED_EVENT_HINT =
  'Partagé avec la palanquée — modifiable par la personne qui a créé la plongée';

/** Id of the control of `field`: target of the error summary links. */
export const fieldId = (field: DiveFormField) => `dive-field-${field}`;

/** Id of a section: target of the summary anchors and of the scroll-spy. */
export const sectionId = (section: DiveFormSection) => `dive-section-${section}`;

/** What a `FormField` needs from the form, its label and children apart. */
export interface FieldBinding {
  id: string;
  required: boolean;
  locked: boolean;
  hint: ReactNode;
  error: ReactNode;
  warning: ReactNode;
}

/** Fields typed as text (« 12,5 », « 10:05 »). */
export type TextField = {
  [K in DiveFormField]: DiveFormValues[K] extends string ? K : never;
}[DiveFormField];

/** Binds fields of `form` to `FormField`s; event fields are locked when `canEditEvent` is false. */
export function fieldBinder(form: DiveForm, canEditEvent: boolean) {
  return (field: DiveFormField, hint?: ReactNode): FieldBinding => {
    const locked = !isFieldEditable(field, canEditEvent);
    return {
      id: fieldId(field),
      required: REQUIRED_FIELDS.includes(field),
      locked,
      hint: locked ? LOCKED_EVENT_HINT : hint,
      error: form.errors[field],
      warning: form.warnings[field],
    };
  };
}

/** Value, change and blur of a `NumberInput`. */
export function numberProps(form: DiveForm, field: TextField) {
  return {
    value: form.values[field],
    onValueChange: (value: string) => form.change(field, value),
    onBlur: () => form.blur(field),
  };
}

/** Value, change and blur of a `TextInput`, `DateInput` or `TimeInput`. */
export function textProps(form: DiveForm, field: TextField) {
  return {
    value: form.values[field],
    onChange: (event: ChangeEvent<HTMLInputElement>) => form.change(field, event.target.value),
    onBlur: () => form.blur(field),
  };
}

/** Options of a segmented control or select: the values in their order, labels capitalised. */
export function choiceOptions<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): { value: T; label: string }[] {
  return values.map((value) => ({ value, label: capitalize(labels[value]) }));
}
