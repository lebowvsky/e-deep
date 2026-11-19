import { useEffect, useMemo, useReducer, useRef, type ActionDispatch, type RefObject } from 'react';
import type { SaveDive, SaveDiveResult } from '../api/saveDive';
import type { DiveDetailView } from '../types';
import { toSaveDiveInput, type DiveFormIds, type DiveFormTarget } from './convert';
import {
  changeAction,
  diveFormReducer,
  initDiveFormState,
  invalidFields,
  type DiveFormAction,
  type FieldMessages,
  type SubmitStatus,
} from './diveFormReducer';
import { draftKey, type DiveDraft, type DraftStore } from './draftStore';
import {
  isDirtyValues,
  type DiveFormField,
  type DiveFormValues,
  type TeamMemberValue,
} from './model';
import { carriedValues, type DiveFormMode } from './prefill';
import { issueFields, validateDiveForm, type ValidationContext } from './validation';

/** Delay without typing before the draft is written on the device (spec). */
export const DRAFT_DEBOUNCE_MS = 1000;

export interface UseDiveFormOptions {
  /** Decides the draft key. Remount the form (`key`) when it changes. */
  mode: DiveFormMode;
  /** Values of the mode (`newDiveValues`, `duplicateDiveValues`, `editDiveValues`). */
  initialValues: DiveFormValues;
  /** What saving does: a new dive, or the update of the edited one (`editTarget`). */
  target: DiveFormTarget;
  /** Today and the diver's level: read at each validation. Keep it stable (memoised actions). */
  context: ValidationContext;
  saveDive: SaveDive;
  draftStore: DraftStore;
  /**
   * Ids of new dives, sites, buddies and rows: `crypto.randomUUID()` (v4) by default, D22 expects a
   * UUIDv7. Keep it stable (memoised actions).
   */
  newId?: () => string;
  /** Epoch milliseconds, for the draft time. */
  now?: () => number;
}

export type SubmitOutcome =
  /** Fields to fix, in the order of the form: scroll to and focus the first one. */
  | { status: 'invalid'; fields: DiveFormField[] }
  /** Saved under `id`, with the logbook number the dive got (D26). */
  | { status: 'saved'; id: string; number: number }
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

/**
 * What the sections do to the values. The same object from one render to the next (as long as
 * `context` and `newId` are), so that a memoised section does not re-render on every key typed
 * elsewhere.
 */
export interface DiveFormActions {
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
  /**
   * Ids of the new dive and of a site typed by name: drawn once, sent again on a retry, kept by the
   * draft (a restored draft sends its own). New ones for another dive (« Effacer », reset).
   */
  ids: DiveFormIds;
  actions: DiveFormActions;
  /** « Effacer » of the restored draft. */
  discardDraft: () => void;
  /**
   * Writes the draft still waiting for its delay, at once: the diver confirms leaving. Also done on
   * `pagehide` and unmount.
   */
  flushDraft: () => void;
  submit: () => Promise<SubmitOutcome>;
}

const randomId = () => crypto.randomUUID();

const drawIds = (newId: () => string): DiveFormIds => ({ eventId: newId(), newSiteId: newId() });

/** A draft before its save time. */
type PendingDraft = Omit<DiveDraft, 'savedAt'>;

interface DraftWriter {
  /** Values changed but not written yet, `null` when the stored draft is up to date. */
  pending: RefObject<PendingDraft | null>;
  store: DraftStore;
  key: string;
  now: () => number;
  dispatch: ActionDispatch<[action: DiveFormAction]>;
}

/** Writes the pending draft, if any. `localStorage` writes synchronously: safe on `pagehide`. */
function writePendingDraft({ pending, store, key, now, dispatch }: DraftWriter): void {
  const draft = pending.current;
  if (draft === null) return;
  pending.current = null;
  const savedAt = now();
  void store
    .save(key, { ...draft, savedAt })
    .then(() => dispatch({ type: 'draftSaved', savedAt }))
    // Not saved: the mention keeps the previous time, the form goes on.
    .catch(() => undefined);
}

function createActions(
  dispatch: ActionDispatch<[action: DiveFormAction]>,
  context: ValidationContext,
  newId: () => string,
): DiveFormActions {
  return {
    change: (field, value) => dispatch(changeAction(field, value, context)),
    blur: (field) => dispatch({ type: 'blur', field, context }),
    addMember: (member) =>
      dispatch({ type: 'addMember', member: { ...member, key: member.id ?? newId() }, context }),
    removeMember: (key) => dispatch({ type: 'removeMember', key, context }),
    setMemberLevel: (key, level) => dispatch({ type: 'setMemberLevel', key, level, context }),
    addDecoStop: () => dispatch({ type: 'addDecoStop', key: newId(), context }),
    removeDecoStop: (key) => dispatch({ type: 'removeDecoStop', key, context }),
    changeDecoStop: (key, part, value) =>
      dispatch({ type: 'changeDecoStop', key, part, value, context }),
    resume: (source) => dispatch({ type: 'merge', values: carriedValues(source), context }),
    reset: (values) => dispatch({ type: 'reset', values, ids: drawIds(newId) }),
  };
}

/**
 * State of the dive form: values, messages, submit and draft.
 *
 * Validation runs at blur, then live once a field shows a message, then in full on submit. Saving
 * goes through the injected `saveDive` port; the draft through the injected `DraftStore`, written
 * 1 s after the last change — at once when the page is left — and cleared once the dive is saved.
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
  const [state, dispatch] = useReducer(diveFormReducer, initialValues, (values) =>
    initDiveFormState(values, drawIds(newId)),
  );
  const { ids } = state;
  const actions = useMemo(() => createActions(dispatch, context, newId), [context, newId]);
  const isSubmitting = useRef(false);
  const pendingDraft = useRef<PendingDraft | null>(null);
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
      pendingDraft.current = null;
      if (hasSavedDraft) {
        void draftStore.clear(key).then(
          () => dispatch({ type: 'draftCleared' }),
          // Still stored: the mention stays true.
          () => undefined,
        );
      }
      return;
    }
    pendingDraft.current = { values: state.values, ids };
    const timer = setTimeout(
      () => writePendingDraft({ pending: pendingDraft, store: draftStore, key, now, dispatch }),
      DRAFT_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [draftReady, isDirty, hasSavedDraft, draftStore, key, now, state.values, ids]);

  // Leaving within the delay must not lose the last changes: the tab closes or goes to the
  // back-forward cache (`pagehide`, which unlike `beforeunload` keeps the page eligible for that
  // cache), or the form unmounts (in-app navigation).
  useEffect(() => {
    const flush = () =>
      writePendingDraft({ pending: pendingDraft, store: draftStore, key, now, dispatch });
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [draftStore, key, now]);

  async function submit(): Promise<SubmitOutcome> {
    if (isSubmitting.current) return { status: 'busy' };
    const issues = validateDiveForm(state.values, context);
    dispatch({ type: 'submitValidated', issues });
    if (issues.errors.length > 0) return { status: 'invalid', fields: issueFields(issues.errors) };
    const input = toSaveDiveInput(state.values, target, ids);
    if (input === null) {
      // Validation guarantees the required values: reaching this is a bug, not a user error.
      const error = new Error('Validated dive form values could not be converted.');
      dispatch({ type: 'submitFailed' });
      return { status: 'failed', error };
    }
    isSubmitting.current = true;
    let result: SaveDiveResult;
    try {
      result = await saveDive(input);
    } catch (error) {
      dispatch({ type: 'submitFailed' });
      return { status: 'failed', error };
    } finally {
      isSubmitting.current = false;
    }
    if (!result.ok) {
      dispatch({ type: 'submitRejected', fieldErrors: result.fieldErrors });
      return { status: 'invalid', fields: invalidFields(result.fieldErrors) };
    }
    // Saved: the redirect may unmount the form before the draft effect sees it clean.
    pendingDraft.current = null;
    dispatch({ type: 'submitSucceeded', id: result.id });
    // The dive is saved whatever happens to its draft: a draft left behind is not a failed save.
    void draftStore.clear(key).catch(() => undefined);
    return { status: 'saved', id: result.id, number: result.number };
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
    ids,
    actions,
    discardDraft: () => {
      pendingDraft.current = null;
      dispatch({ type: 'draftDiscarded', ids: drawIds(newId) });
      void draftStore.clear(key).catch(() => undefined);
    },
    flushDraft: () =>
      writePendingDraft({ pending: pendingDraft, store: draftStore, key, now, dispatch }),
    submit,
  };
}
