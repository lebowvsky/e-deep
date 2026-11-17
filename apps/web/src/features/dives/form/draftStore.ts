// Dive form — draft kept on the device, one per mode and per dive.
//
// Behind `DraftStore` so that IndexedDB can replace `localStorage` (asynchronous on purpose). The
// stored data is untrusted (another version of the app, a hand edit): it is checked by a guard and
// ignored when it does not match. Nothing is ever logged: a draft holds health data.
import {
  isArrayOf,
  isBoolean,
  isNullable,
  isNumber,
  isOneOf,
  isRecord,
  isString,
} from '@/shared/lib/guards';
import {
  CURRENT_STRENGTHS,
  ENTRY_TYPES,
  SEA_STATES,
  SUIT_TYPES,
  TANK_MATERIALS,
  TIMES_OF_DAY,
  WEATHERS,
} from '../api/divesApi';
import type { DiveFormValues } from './model';
import type { DiveFormMode } from './prefill';

export interface DiveDraft {
  values: DiveFormValues;
  /** Epoch milliseconds of the save. */
  savedAt: number;
}

export interface DraftStore {
  load(key: string): Promise<DiveDraft | null>;
  save(key: string, draft: DiveDraft): Promise<void>;
  clear(key: string): Promise<void>;
}

const KEY_PREFIX = 'e-deep:dive-draft:';
/** Bumped when `DiveFormValues` changes shape: older drafts are then ignored. */
const DRAFT_VERSION = 1;

/** `new`, `new:from:<id>` or `edit:<id>`, prefixed. */
export function draftKey(mode: DiveFormMode): string {
  switch (mode.kind) {
    case 'new':
      return `${KEY_PREFIX}new`;
    case 'duplicate':
      return `${KEY_PREFIX}new:from:${mode.sourceId}`;
    case 'edit':
      return `${KEY_PREFIX}edit:${mode.diveId}`;
  }
}

// ── Guard ─────────────────────────────────────────────────────────────────────────────────────

const GASES = ['AIR', 'NITROX'] as const;

const oneOrNull =
  <const T extends string>(options: readonly T[]) =>
  (value: unknown): value is T | null =>
    value === null || isOneOf(value, options);

const isNullableString = isNullable(isString);

function isSite(value: unknown): value is DiveFormValues['site'] {
  return isRecord(value) && isNullableString(value.id) && isString(value.name);
}

function isTeamMember(value: unknown): value is DiveFormValues['team'][number] {
  return (
    isRecord(value) &&
    isString(value.key) &&
    isNullableString(value.id) &&
    isString(value.firstName) &&
    isString(value.lastName) &&
    isString(value.level)
  );
}

function isDecoStop(value: unknown): value is DiveFormValues['decoStops'][number] {
  return (
    isRecord(value) && isString(value.key) && isString(value.depthM) && isString(value.durationMin)
  );
}

const STRING_FIELDS = [
  'number',
  'date',
  'entryTime',
  'exitTime',
  'durationMin',
  'maxDepthM',
  'safetyStopDurationMin',
  'safetyStopDepthM',
  'surfaceInterval',
  'o2Percent',
  'tankVolumeL',
  'startPressureBar',
  'endPressureBar',
  'suitThicknessMm',
  'weightKg',
  'diveCenter',
  'airTemperatureC',
  'surfaceTemperatureC',
  'bottomTemperatureC',
  'visibilityM',
  'notes',
] as const satisfies readonly (keyof DiveFormValues)[];

const BOOLEAN_FIELDS = [
  'safetyStop',
  'stopsOk',
  'decompression',
  'repetitive',
] as const satisfies readonly (keyof DiveFormValues)[];

export function isDiveFormValues(value: unknown): value is DiveFormValues {
  return (
    isRecord(value) &&
    STRING_FIELDS.every((field) => isString(value[field])) &&
    BOOLEAN_FIELDS.every((field) => isBoolean(value[field])) &&
    isSite(value.site) &&
    isArrayOf(isDecoStop)(value.decoStops) &&
    isArrayOf(isTeamMember)(value.team) &&
    isOneOf(value.gas, GASES) &&
    oneOrNull(TANK_MATERIALS)(value.tankMaterial) &&
    oneOrNull(SUIT_TYPES)(value.suitType) &&
    oneOrNull(ENTRY_TYPES)(value.entryType) &&
    oneOrNull(TIMES_OF_DAY)(value.timeOfDay) &&
    oneOrNull(WEATHERS)(value.weather) &&
    oneOrNull(SEA_STATES)(value.seaState) &&
    oneOrNull(CURRENT_STRENGTHS)(value.currentStrength) &&
    isArrayOf(isString)(value.species)
  );
}

function parseDraft(text: string): DiveDraft | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    // Corrupted draft: same as no draft.
    return null;
  }
  if (!isRecord(data) || data.version !== DRAFT_VERSION) return null;
  const { savedAt, values } = data;
  return isNumber(savedAt) && isDiveFormValues(values) ? { savedAt, values } : null;
}

// ── localStorage ──────────────────────────────────────────────────────────────────────────────

/**
 * Drafts in `localStorage`. Every access is guarded: storage may be disabled (private mode), full
 * or blocked by the browser; a draft is a comfort, its failure never reaches the form.
 */
export function createLocalDraftStore(storage: Storage | null = safeLocalStorage()): DraftStore {
  return {
    load(key) {
      try {
        const text = storage?.getItem(key) ?? null;
        return Promise.resolve(text === null ? null : parseDraft(text));
      } catch {
        return Promise.resolve(null);
      }
    },
    save(key, draft) {
      try {
        storage?.setItem(key, JSON.stringify({ version: DRAFT_VERSION, ...draft }));
      } catch {
        // Quota exceeded or storage blocked: the form keeps working without a draft.
      }
      return Promise.resolve();
    },
    clear(key) {
      try {
        storage?.removeItem(key);
      } catch {
        // Storage blocked: nothing to clear.
      }
      return Promise.resolve();
    },
  };
}

/** Reading `window.localStorage` itself throws when the browser blocks it. */
function safeLocalStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
