// Dive form — wiring of a field of `useDiveForm` to the `shared/ui` controls: one place for the
// id targeted by the error summary, the label, the messages, the « * » and the lock of the shared
// event. Also the comparison that lets a section skip the renders caused by other sections.
import type { ChangeEvent, ReactNode } from 'react';
import { capitalize } from '@/shared/lib/format';
import type { DiveForm } from '../../form/useDiveForm';
import {
  DIVE_FORM_FIELDS,
  FIELD_LABELS,
  FIELD_SECTIONS,
  isFieldEditable,
  isSameValue,
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

/** What a section reads of the form: values, messages and the (stable) actions. */
export type SectionForm = Pick<DiveForm, 'values' | 'errors' | 'warnings' | 'actions'>;

/** What a `FormField` needs from the form, its children apart. */
export interface FieldBinding {
  id: string;
  /** `FIELD_LABELS`, the label of the error summary: put `label` after the spread to change it. */
  label: string;
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
export function fieldBinder(form: SectionForm, canEditEvent: boolean) {
  return (field: DiveFormField, hint?: ReactNode): FieldBinding => {
    const locked = !isFieldEditable(field, canEditEvent);
    return {
      id: fieldId(field),
      label: FIELD_LABELS[field],
      required: REQUIRED_FIELDS.includes(field),
      locked,
      hint: locked ? LOCKED_EVENT_HINT : hint,
      error: form.errors[field],
      warning: form.warnings[field],
    };
  };
}

/** Value, change and blur of a `NumberInput`. */
export function numberProps(form: SectionForm, field: TextField) {
  return {
    value: form.values[field],
    onValueChange: (value: string) => form.actions.change(field, value),
    onBlur: () => form.actions.blur(field),
  };
}

/** Value, change and blur of a `TextInput`, `DateInput` or `TimeInput`. */
export function textProps(form: SectionForm, field: TextField) {
  return {
    value: form.values[field],
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      form.actions.change(field, event.target.value),
    onBlur: () => form.actions.blur(field),
  };
}

/**
 * The fields a section reads: its own, plus `extra` read elsewhere in the form. A section that
 * starts reading another field must list it here, or it would show a stale value (see
 * `sameSectionProps`).
 */
export function sectionReads(
  section: DiveFormSection,
  extra: readonly DiveFormField[] = [],
): DiveFormField[] {
  return [...DIVE_FORM_FIELDS.filter((field) => FIELD_SECTIONS[field] === section), ...extra];
}

/**
 * `memo` comparison of a section (no React Compiler here): the form object is new on every key
 * typed, so only the fields the section `reads` are compared, with their messages and the actions.
 * Any other prop is compared by value (the folded state is rebuilt on every render).
 */
export function sameSectionProps<P extends { form: SectionForm }>(reads: readonly DiveFormField[]) {
  return (prev: Readonly<P>, next: Readonly<P>): boolean => {
    const keys = Object.keys(next);
    if (keys.length !== Object.keys(prev).length) return false;
    return keys.every((key) =>
      key === 'form'
        ? sameFormSlice(prev.form, next.form, reads)
        : isSameValue(Reflect.get(prev, key), Reflect.get(next, key)),
    );
  };
}

function sameFormSlice(prev: SectionForm, next: SectionForm, reads: readonly DiveFormField[]) {
  return (
    prev.actions === next.actions &&
    reads.every(
      (field) =>
        prev.values[field] === next.values[field] &&
        prev.errors[field] === next.errors[field] &&
        prev.warnings[field] === next.warnings[field],
    )
  );
}

/** Options of a segmented control or select: the values in their order, labels capitalised. */
export function choiceOptions<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): { value: T; label: string }[] {
  return values.map((value) => ({ value, label: capitalize(labels[value]) }));
}
