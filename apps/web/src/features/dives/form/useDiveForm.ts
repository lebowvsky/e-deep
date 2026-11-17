import { useEffect, useReducer, useRef } from 'react';
import type { SaveDive } from '../api/saveDive';
import type { DiveDetailView } from '../types';
import { toSaveDiveInput, type DiveFormTarget } from './convert';
import {
  diveFormReducer,
  initDiveFormState,
  type FieldMessages,
  type SubmitStatus,
} from './diveFormReducer';
import { draftKey, type DraftStore } from './draftStore';
import {
  DIVE_FORM_FIELDS,
  isDirtyValues,
  type DiveFormField,
  type DiveFormValues,
  type TeamMemberValue,
} from './model';
import { carriedValues, type DiveFormMode } from './prefill';
import { validateDiveForm, type ValidationContext } from './validation';

/** Delay without typing before the draft is written on the device (spec). */
export const DRAFT_DEBOUNCE_MS = 1000;

export interface UseDiveFormOptions {
  /** Decides the draft key. Remount the form (`key`) when it changes. */
  mode: DiveFormMode;
  /** Values of the mode (`newDiveValues`, `duplicateDiveValues`, `editDiveValues`). */
  initialValues: DiveFormValues;
  /** What saving does: a new dive, or the update of the edited one (`editTarget`). */
  target: DiveFormTarget;
  /** Today, the diver's level and the numbers already taken: read at each validation. */
  context: ValidationContext;
  saveDive: SaveDive;
  draftStore: DraftStore;
  /** Ids of new dives, sites, buddies and rows: `crypto.randomUUID()` (v4) by default, D22 expects a UUIDv7. */
  newId?: () => string;
  /** Epoch milliseconds, for the draft time. */
  now?: () => number;
}

export type SubmitOutcome =
  /** Fields to fix, in the order of the form: scroll to and focus the first one. */
  | { status: 'invalid'; fields: DiveFormField[] }
  | { status: 'saved'; id: string }
  /** Unexpected failure: the error is handed over, to be reported by the page. */
  | { status: 'failed'; error: unknown }
  /** A submit is already running: nothing was sent. */
  | { status: 'busy' };

export interface DiveFormDraft {
  /** The stored draft is still being looked for. */
  isChecking: boolean;
  /** « Brouillon enregistré sur l'appareil · hh:mm », `null` before the first save. */
  savedAt: Date | null;
  /** « Brouillon restauré · [Effacer] ». */
  isRestored: boolean;
}

export interface DiveForm {
  values: DiveFormValues;
  /** Messages on screen, by field. */
  errors: FieldMessages;
  warnings: FieldMessages;
  touched: Partial<Record<DiveFormField, true>>;
  isDirty: boolean;
  submitStatus: SubmitStatus;
  draft: DiveFormDraft;
  change: <K extends DiveFormField>(field: K, value: DiveFormValues[K]) => void;
  blur: (field: DiveFormField) => void;
  addMember: (member: Omit<TeamMemberValue, 'key'>) => void;
  removeMember: (key: string) => void;
  setMemberLevel: (key: string, level: string) => void;
  addDecoStop: () => void;
  removeDecoStop: (key: string) => void;
  changeDecoStop: (key: string, part: 'depthM' | 'durationMin', value: string) => void;
  /** « Reprendre » of the suggestion: dive team, equipment and conditions of `source`. */
  resume: (source: DiveDetailView) => void;
  /** « Repartir de zéro »: new starting values, messages cleared. */
  reset: (values: DiveFormValues) => void;
  /** « Effacer » of the restored draft. */
  discardDraft: () => void;
  submit: () => Promise<SubmitOutcome>;
}

const randomId = () => crypto.randomUUID();

/**
 * State of the dive form: values, messages, submit and draft.
 *
 * Validation runs at blur, then live once a field shows a message, then in full on submit. Saving
 * goes through the injected `saveDive` port; the draft through the injected `DraftStore`, written
 * 1 s after the last change and cleared once the dive is saved.
 */
export function useDiveForm({
  mode,
  initialValues,
  target,
  context,
  saveDive,
  draftStore,
  newId = randomId,
  now = Date.now,
}: UseDiveFormOptions): DiveForm {
  const [state, dispatch] = useReducer(diveFormReducer, initialValues, initDiveFormState);
  const isSubmitting = useRef(false);
  const key = draftKey(mode);
  const isDirty = isDirtyValues(state.values, state.initial);
  const draftReady = state.draft.status === 'ready';
  const hasSavedDraft = state.draft.status === 'ready' && state.draft.savedAt !== null;

  // Look for a draft of this mode once, when the form opens.
  useEffect(() => {
    let isCurrent = true;
    void draftStore
      .load(key)
      // A draft is a comfort: a store that fails to read is the same as no draft.
      .catch(() => null)
      .then((draft) => {
        if (isCurrent) dispatch({ type: 'draftChecked', draft });
      });
    return () => {
      isCurrent = false;
    };
  }, [draftStore, key]);

  // Keep the draft in sync with the values, 1 s after the last change.
  useEffect(() => {
    if (!draftReady) return;
    if (!isDirty) {
      if (hasSavedDraft) void draftStore.clear(key);
      return;
    }
    const timer = setTimeout(() => {
      const savedAt = now();
      void draftStore
        .save(key, { values: state.values, savedAt })
        .then(() => dispatch({ type: 'draftSaved', savedAt }))
        // Not saved: the mention keeps the previous time, the form goes on.
        .catch(() => undefined);
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draftReady, isDirty, hasSavedDraft, draftStore, key, now, state.values]);

  async function submit(): Promise<SubmitOutcome> {
    if (isSubmitting.current) return { status: 'busy' };
    const issues = validateDiveForm(state.values, context);
    dispatch({ type: 'submitValidated', issues });
    if (issues.errors.length > 0) {
      return { status: 'invalid', fields: issues.errors.map(({ field }) => field) };
    }
    const input = toSaveDiveInput(state.values, target, newId);
    if (input === null) {
      // Validation guarantees the required values: reaching this is a bug, not a user error.
      const error = new Error('Validated dive form values could not be converted.');
      dispatch({ type: 'submitFailed' });
      return { status: 'failed', error };
    }
    isSubmitting.current = true;
    try {
      const result = await saveDive(input);
      if (!result.ok) {
        dispatch({ type: 'submitRejected', fieldErrors: result.fieldErrors });
        const { fieldErrors } = result;
        const fields = DIVE_FORM_FIELDS.filter((field) => fieldErrors[field] !== undefined);
        return { status: 'invalid', fields };
      }
      await draftStore.clear(key);
      dispatch({ type: 'submitSucceeded', id: result.id });
      return { status: 'saved', id: result.id };
    } catch (error) {
      dispatch({ type: 'submitFailed' });
      return { status: 'failed', error };
    } finally {
      isSubmitting.current = false;
    }
  }

  return {
    values: state.values,
    errors: state.errors,
    warnings: state.warnings,
    touched: state.touched,
    isDirty,
    submitStatus: state.submit,
    draft: {
      isChecking: state.draft.status === 'checking',
      savedAt:
        state.draft.status === 'ready' && state.draft.savedAt !== null
          ? new Date(state.draft.savedAt)
          : null,
      isRestored: state.draft.status === 'ready' && state.draft.restored,
    },
    change: (field, value) => dispatch({ type: 'change', field, value, context }),
    blur: (field) => dispatch({ type: 'blur', field, context }),
    addMember: (member) =>
      dispatch({ type: 'addMember', member: { ...member, key: member.id ?? newId() }, context }),
    removeMember: (memberKey) => dispatch({ type: 'removeMember', key: memberKey, context }),
    setMemberLevel: (memberKey, level) =>
      dispatch({ type: 'setMemberLevel', key: memberKey, level }),
    addDecoStop: () => dispatch({ type: 'addDecoStop', key: newId(), context }),
    removeDecoStop: (stopKey) => dispatch({ type: 'removeDecoStop', key: stopKey, context }),
    changeDecoStop: (stopKey, part, value) =>
      dispatch({ type: 'changeDecoStop', key: stopKey, part, value, context }),
    resume: (source) => dispatch({ type: 'merge', values: carriedValues(source), context }),
    reset: (values) => dispatch({ type: 'reset', values }),
    discardDraft: () => {
      dispatch({ type: 'draftDiscarded' });
      void draftStore.clear(key);
    },
    submit,
  };
}
