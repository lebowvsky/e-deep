// Dive form — state machine of the form. Pure: the hook supplies the validation context and the
// keys of new rows in the actions, so that the reducer stays testable alone.
import { parseNumberInput } from '@/shared/lib/numberInput';
import {
  DIVE_FORM_FIELDS,
  SAFETY_STOP_DEFAULTS,
  type DecoStopValue,
  type DiveFormField,
  type DiveFormValues,
  type TeamMemberValue,
} from './model';
import { durationFromTimes, exitFromDuration } from './timeLink';
import {
  DEPENDENT_FIELDS,
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
  touched: Partial<Record<DiveFormField, true>>;
  /** Messages on screen: shown after a blur or a submit, then updated live. */
  errors: FieldMessages;
  warnings: FieldMessages;
  submit: SubmitStatus;
  draft: DraftStatus;
}

/** `value` matches `field` when the action is built through `useDiveForm().change`. */
export interface ChangeAction<K extends DiveFormField = DiveFormField> {
  type: 'change';
  field: K;
  value: DiveFormValues[K];
  context: ValidationContext;
}

export type DiveFormAction =
  | ChangeAction
  | { type: 'blur'; field: DiveFormField; context: ValidationContext }
  | { type: 'addMember'; member: TeamMemberValue; context: ValidationContext }
  | { type: 'removeMember'; key: string; context: ValidationContext }
  | { type: 'setMemberLevel'; key: string; level: string }
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
  /** Opening a mode, or « Repartir de zéro »: new starting point, messages cleared. */
  | { type: 'reset'; values: DiveFormValues }
  | { type: 'draftChecked'; draft: { values: DiveFormValues; savedAt: number } | null }
  | { type: 'draftSaved'; savedAt: number }
  /** « Effacer » of the restored draft: back to the starting values. */
  | { type: 'draftDiscarded' }
  /** Submit: the full validation, run by the hook (blocked when it has errors). */
  | { type: 'submitValidated'; issues: DiveFormIssues }
  | { type: 'submitRejected'; fieldErrors: FieldMessages }
  | { type: 'submitFailed' }
  | { type: 'submitSucceeded'; id: string };

export function initDiveFormState(values: DiveFormValues): DiveFormState {
  return {
    values,
    initial: values,
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
      // The duration is the diver's measure: keep it, move the exit. Without one, compute it.
      const exitTime = fromDuration();
      if (exitTime !== null) return { ...values, exitTime };
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

function updateValues(
  state: DiveFormState,
  values: DiveFormValues,
  context: ValidationContext,
): DiveFormState {
  const changed = changedFields(state.values, values);
  // A new edit after a submit outcome: the button goes back to its idle state.
  const submit: SubmitStatus =
    state.submit.status === 'submitting' ? state.submit : { status: 'idle' };
  let next: DiveFormState = { ...state, values, submit };
  for (const field of changed) next = revalidateShown(next, field, context);
  return next;
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
      return {
        ...state,
        values: {
          ...state.values,
          team: mapTeam(state.values.team, action.key, (member) => ({
            ...member,
            level: action.level,
          })),
        },
      };
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
        ...initDiveFormState(action.values),
        draft: state.draft.status === 'ready' ? { ...state.draft, restored: false } : state.draft,
      };
    case 'draftChecked':
      return action.draft === null
        ? { ...state, draft: { status: 'ready', savedAt: null, restored: false } }
        : {
            ...state,
            values: action.draft.values,
            draft: { status: 'ready', savedAt: action.draft.savedAt, restored: true },
          };
    case 'draftSaved':
      return state.draft.status === 'ready'
        ? { ...state, draft: { ...state.draft, savedAt: action.savedAt } }
        : state;
    case 'draftDiscarded':
      return {
        ...initDiveFormState(state.initial),
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
        ? { ...shown, submit: { status: 'invalid', fields: errors.map(({ field }) => field) } }
        : { ...shown, submit: { status: 'submitting' } };
    }
    case 'submitRejected': {
      const fields = DIVE_FORM_FIELDS.filter((field) => action.fieldErrors[field] !== undefined);
      return {
        ...state,
        errors: { ...state.errors, ...action.fieldErrors },
        submit: { status: 'invalid', fields },
      };
    }
    case 'submitFailed':
      return { ...state, submit: { status: 'failed' } };
    case 'submitSucceeded':
      return { ...state, initial: state.values, submit: { status: 'saved', id: action.id } };
  }
}
