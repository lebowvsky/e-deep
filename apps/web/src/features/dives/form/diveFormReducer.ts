// Dive form — state machine of the form. Pure: the hook supplies the validation context and the
// keys of new rows in the actions, so that the reducer stays testable alone.
import { parseNumberInput } from '@/shared/lib/numberInput';
import type { DiveFormIds } from './convert';
import {
  DIVE_FORM_FIELDS,
  isDirtyValues,
  SAFETY_STOP_DEFAULTS,
  type DecoStopValue,
  type DiveFormField,
  type DiveFormValues,
  type TeamMemberValue,
} from './model';
import { durationFromTimes, exitFromDuration } from './timeLink';
import {
  DEPENDENT_FIELDS,
  issueFields,
  validateField,
  type DiveFormIssues,
  type FieldIssue,
  type ValidationContext,
} from './validation';

export type FieldMessages = Partial<Record<DiveFormField, string>>;

export type SubmitStatus =
  | { status: 'idle' }
  | { status: 'submitting' }
  /** Blocked before saving, or rejected by `saveDive`: the fields to fix, in the form's order. */
  | { status: 'invalid'; fields: DiveFormField[] }
  /** Unexpected failure of `saveDive` (network, bug): the values stay, the diver can retry. */
  | { status: 'failed' }
  | { status: 'saved'; id: string };

export type DraftStatus =
  /** The stored draft is being looked for: nothing is saved meanwhile. */
  { status: 'checking' } | { status: 'ready'; savedAt: number | null; restored: boolean };

export interface DiveFormState {
  values: DiveFormValues;
  /** What the form opened with: `isDirty` compares against it. */
  initial: DiveFormValues;
  /** Ids a new dive is sent with: kept by the draft, new for another dive (reset, discard). */
  ids: DiveFormIds;
  touched: Partial<Record<DiveFormField, true>>;
  /** Messages on screen: shown after a blur or a submit, then updated live. */
  errors: FieldMessages;
  warnings: FieldMessages;
  submit: SubmitStatus;
  draft: DraftStatus;
}

/** One member per field: `value` always has the type of its `field`. */
export type ChangeAction = {
  [K in DiveFormField]: {
    type: 'change';
    field: K;
    value: DiveFormValues[K];
    context: ValidationContext;
  };
}[DiveFormField];

/**
 * Builds a `change` action. The distributive `ChangeAction` cannot be written from a generic `K`
 * directly; this is the one place that bridges the two, for `useDiveForm().actions.change`.
 */
export function changeAction<K extends DiveFormField>(
  field: K,
  value: DiveFormValues[K],
  context: ValidationContext,
): ChangeAction {
  return { type: 'change', field, value, context } as ChangeAction;
}

export type DiveFormAction =
  | ChangeAction
  | { type: 'blur'; field: DiveFormField; context: ValidationContext }
  | { type: 'addMember'; member: TeamMemberValue; context: ValidationContext }
  | { type: 'removeMember'; key: string; context: ValidationContext }
  | { type: 'setMemberLevel'; key: string; level: string; context: ValidationContext }
  | { type: 'addDecoStop'; key: string; context: ValidationContext }
  | { type: 'removeDecoStop'; key: string; context: ValidationContext }
  | {
      type: 'changeDecoStop';
      key: string;
      part: 'depthM' | 'durationMin';
      value: string;
      context: ValidationContext;
    }
  /** « Reprendre »: some values replaced by the user, the form stays dirty. */
  | { type: 'merge'; values: Partial<DiveFormValues>; context: ValidationContext }
  /** « Repartir de zéro »: new starting point and another dive (`ids`), messages cleared. */
  | { type: 'reset'; values: DiveFormValues; ids: DiveFormIds }
  | {
      type: 'draftChecked';
      draft: { values: DiveFormValues; ids: DiveFormIds; savedAt: number } | null;
    }
  | { type: 'draftSaved'; savedAt: number }
  /** The stored draft was deleted (values back to their start): no mention any more. */
  | { type: 'draftCleared' }
  /**
   * « Effacer » of the restored draft: back to the starting values, with new `ids` — those of the
   * draft may name a dive the API stored, that a save would then replace.
   */
  | { type: 'draftDiscarded'; ids: DiveFormIds }
  /** Submit: the full validation, run by the hook (blocked when it has errors). */
  | { type: 'submitValidated'; issues: DiveFormIssues }
  | { type: 'submitRejected'; fieldErrors: FieldMessages }
  | { type: 'submitFailed' }
  | { type: 'submitSucceeded'; id: string };

export function initDiveFormState(values: DiveFormValues, ids: DiveFormIds): DiveFormState {
  return {
    values,
    initial: values,
    ids,
    touched: {},
    errors: {},
    warnings: {},
    submit: { status: 'idle' },
    draft: { status: 'checking' },
  };
}

// ── Time link ─────────────────────────────────────────────────────────────────────────────────

/** Keeps immersion, exit and duration consistent after `field` changed (see timeLink). */
function linkTimes(values: DiveFormValues, field: DiveFormField): DiveFormValues {
  const isNight = values.timeOfDay === 'NIGHT';
  const fromDuration = () =>
    exitFromDuration(values.entryTime, parseNumberInput(values.durationMin), isNight);
  const fromTimes = () => durationFromTimes(values.entryTime, values.exitTime, isNight);

  switch (field) {
    case 'durationMin': {
      const exitTime = fromDuration();
      return exitTime === null ? values : { ...values, exitTime };
    }
    case 'entryTime': {
      // The duration is the diver's measure: keep it, move the exit (or leave the exit to the
      // validation when it cannot move, past midnight by day). Without one, compute it.
      if (values.durationMin.trim() !== '') {
        const exitTime = fromDuration();
        return exitTime === null ? values : { ...values, exitTime };
      }
      const duration = fromTimes();
      return duration === null ? values : { ...values, durationMin: String(duration) };
    }
    case 'exitTime':
    case 'timeOfDay': {
      const duration = fromTimes();
      return duration === null ? values : { ...values, durationMin: String(duration) };
    }
    default:
      return values;
  }
}

/** Side effects of a value on the others: time link, safety stop defaults. */
function applyChange(values: DiveFormValues, field: DiveFormField): DiveFormValues {
  if (field === 'safetyStop' && values.safetyStop) {
    return {
      ...values,
      safetyStopDurationMin: values.safetyStopDurationMin || SAFETY_STOP_DEFAULTS.durationMin,
      safetyStopDepthM: values.safetyStopDepthM || SAFETY_STOP_DEFAULTS.depthM,
    };
  }
  return linkTimes(values, field);
}

// ── Messages ──────────────────────────────────────────────────────────────────────────────────

function withMessage(messages: FieldMessages, field: DiveFormField, message: string | null) {
  if (message === null) {
    if (!(field in messages)) return messages;
    const { [field]: _removed, ...rest } = messages;
    return rest;
  }
  return messages[field] === message ? messages : { ...messages, [field]: message };
}

/** Checks `fields` again and puts their messages (or their absence) on screen. */
function revalidate(
  state: DiveFormState,
  fields: readonly DiveFormField[],
  context: ValidationContext,
): DiveFormState {
  let { errors, warnings } = state;
  for (const field of fields) {
    const issue = validateField(field, state.values, context);
    errors = withMessage(errors, field, issue?.level === 'error' ? issue.message : null);
    warnings = withMessage(warnings, field, issue?.level === 'warning' ? issue.message : null);
  }
  return errors === state.errors && warnings === state.warnings
    ? state
    : { ...state, errors, warnings };
}

function toMessages(issues: readonly FieldIssue[]): FieldMessages {
  const messages: FieldMessages = {};
  for (const { field, message } of issues) messages[field] = message;
  return messages;
}

const isShown = (state: DiveFormState, field: DiveFormField) =>
  field in state.errors || field in state.warnings;

/**
 * After a change, live validation: only the fields already showing a message (the changed one and
 * those that read it). A field shown valid waits for its blur.
 */
function revalidateShown(
  state: DiveFormState,
  field: DiveFormField,
  context: ValidationContext,
): DiveFormState {
  const candidates = [field, ...(DEPENDENT_FIELDS[field] ?? [])];
  return revalidate(
    state,
    candidates.filter((candidate) => isShown(state, candidate)),
    context,
  );
}

/** Every field whose value changed between two value sets. */
function changedFields(before: DiveFormValues, after: DiveFormValues): DiveFormField[] {
  return DIVE_FORM_FIELDS.filter((field) => before[field] !== after[field]);
}

/** The fields of `errors`, in the order of the form: error summary and first focus. */
export function invalidFields(errors: FieldMessages): DiveFormField[] {
  return DIVE_FORM_FIELDS.filter((field) => errors[field] !== undefined);
}

/**
 * Submit state after a new edit. The error summary stays while some of its fields are still wrong
 * (the diver fixes them one by one through its links); any other outcome goes back to idle.
 */
function submitAfterEdit(submit: SubmitStatus, errors: FieldMessages): SubmitStatus {
  switch (submit.status) {
    case 'submitting':
      return submit;
    case 'invalid': {
      const fields = submit.fields.filter((field) => errors[field] !== undefined);
      if (fields.length === submit.fields.length) return submit;
      return fields.length > 0 ? { status: 'invalid', fields } : { status: 'idle' };
    }
    default:
      return { status: 'idle' };
  }
}

function updateValues(
  state: DiveFormState,
  values: DiveFormValues,
  context: ValidationContext,
): DiveFormState {
  const changed = changedFields(state.values, values);
  let next: DiveFormState = { ...state, values };
  for (const field of changed) next = revalidateShown(next, field, context);
  return { ...next, submit: submitAfterEdit(state.submit, next.errors) };
}

const mapTeam = (
  team: readonly TeamMemberValue[],
  key: string,
  update: (member: TeamMemberValue) => TeamMemberValue,
) => team.map((member) => (member.key === key ? update(member) : member));

const mapStops = (
  stops: readonly DecoStopValue[],
  key: string,
  update: (stop: DecoStopValue) => DecoStopValue,
) => stops.map((stop) => (stop.key === key ? update(stop) : stop));

// ── Reducer ───────────────────────────────────────────────────────────────────────────────────

export function diveFormReducer(state: DiveFormState, action: DiveFormAction): DiveFormState {
  switch (action.type) {
    case 'change': {
      const values = applyChange({ ...state.values, [action.field]: action.value }, action.field);
      return updateValues(state, values, action.context);
    }
    case 'blur':
      return revalidate(
        { ...state, touched: { ...state.touched, [action.field]: true } },
        [action.field, ...(DEPENDENT_FIELDS[action.field] ?? []).filter((f) => isShown(state, f))],
        action.context,
      );
    case 'addMember':
      // The same diver twice would be the same buddy id twice in the dive team.
      if (
        action.member.id !== null &&
        state.values.team.some(({ id }) => id === action.member.id)
      ) {
        return state;
      }
      return updateValues(
        state,
        { ...state.values, team: [...state.values.team, action.member] },
        action.context,
      );
    case 'removeMember':
      return updateValues(
        state,
        { ...state.values, team: state.values.team.filter(({ key }) => key !== action.key) },
        action.context,
      );
    case 'setMemberLevel':
      return updateValues(
        state,
        {
          ...state.values,
          team: mapTeam(state.values.team, action.key, (member) => ({
            ...member,
            level: action.level,
          })),
        },
        action.context,
      );
    case 'addDecoStop':
      return updateValues(
        state,
        {
          ...state.values,
          decoStops: [...state.values.decoStops, { key: action.key, depthM: '', durationMin: '' }],
        },
        action.context,
      );
    case 'removeDecoStop':
      return updateValues(
        state,
        {
          ...state.values,
          decoStops: state.values.decoStops.filter(({ key }) => key !== action.key),
        },
        action.context,
      );
    case 'changeDecoStop':
      return updateValues(
        state,
        {
          ...state.values,
          decoStops: mapStops(state.values.decoStops, action.key, (stop) => ({
            ...stop,
            [action.part]: action.value,
          })),
        },
        action.context,
      );
    case 'merge':
      return updateValues(state, { ...state.values, ...action.values }, action.context);
    case 'reset':
      return {
        ...initDiveFormState(action.values, action.ids),
        draft: state.draft.status === 'ready' ? { ...state.draft, restored: false } : state.draft,
      };
    case 'draftChecked':
      // Nothing stored, or the diver already typed while it was looked for (asynchronous store):
      // what is on screen wins, and the next draft write replaces the stored one.
      return action.draft === null || isDirtyValues(state.values, state.initial)
        ? { ...state, draft: { status: 'ready', savedAt: null, restored: false } }
        : {
            ...state,
            values: action.draft.values,
            ids: action.draft.ids,
            draft: { status: 'ready', savedAt: action.draft.savedAt, restored: true },
          };
    case 'draftSaved':
      return state.draft.status === 'ready'
        ? { ...state, draft: { ...state.draft, savedAt: action.savedAt } }
        : state;
    case 'draftCleared':
      return state.draft.status === 'ready' && state.draft.savedAt !== null
        ? { ...state, draft: { ...state.draft, savedAt: null } }
        : state;
    case 'draftDiscarded':
      return {
        ...initDiveFormState(state.initial, action.ids),
        draft: { status: 'ready', savedAt: null, restored: false },
      };
    case 'submitValidated': {
      if (state.submit.status === 'submitting') return state;
      const { errors, warnings } = action.issues;
      const shown: DiveFormState = {
        ...state,
        errors: toMessages(errors),
        warnings: toMessages(warnings),
      };
      return errors.length > 0
        ? { ...shown, submit: { status: 'invalid', fields: issueFields(errors) } }
        : { ...shown, submit: { status: 'submitting' } };
    }
    case 'submitRejected':
      return {
        ...state,
        errors: { ...state.errors, ...action.fieldErrors },
        submit: { status: 'invalid', fields: invalidFields(action.fieldErrors) },
      };
    case 'submitFailed':
      return { ...state, submit: { status: 'failed' } };
    case 'submitSucceeded':
      return { ...state, initial: state.values, submit: { status: 'saved', id: action.id } };
  }
}
