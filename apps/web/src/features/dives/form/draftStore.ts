// Dive form — draft kept on the device, one per diver, per mode and per dive.
//
// Stored under `e-deep:dive-draft:<diverId>:<mode>` (D41): a draft is health data, another account
// signed in on the same device never sees it. Signing out erases them all (`purgeAllDrafts`, in
// `draftPurge.ts`) and advances the drafts' epoch, so that no store opened before (a form flushing
// on unmount, another tab) can write one again.
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
} from '../lib/unions';
import type { DiveFormIds } from './convert';
import { draftStorageKeys, KEY_PREFIX, readEpoch, safeLocalStorage } from './draftPurge';
import type { DiveFormValues } from './model';
import type { DiveFormMode } from './prefill';

export interface DiveDraft {
  values: DiveFormValues;
  /**
   * Ids the dive is sent with: a draft restored after a save that timed out (yet stored by the API)
   * must send the same ones, or the retry would create a second dive and a second site.
   */
  ids: DiveFormIds;
  /** Epoch milliseconds of the save. */
  savedAt: number;
}

export interface DraftStore {
  load(key: string): Promise<DiveDraft | null>;
  save(key: string, draft: DiveDraft): Promise<void>;
  clear(key: string): Promise<void>;
}

/**
 * Keys written before the drafts had an owner (`e-deep:dive-draft:new`, `…:edit:<id>`): nothing
 * tells whose they are, so they are never restored, and deleted at the next purge. A diver id never
 * starts with these words.
 */
const UNOWNED_KEY = /^(?:new|edit)(?::|$)/;
/**
 * Bumped when the draft changes shape: older drafts are then ignored. 2: the logbook number left
 * the values (computed, D26). 3: the ids of the dive and of a new site are kept with the values.
 */
const DRAFT_VERSION = 3;

/**
 * A draft abandoned for longer is deleted (health data, ARCHITECTURE §9): 30 days covers a trip
 * logged on the way back without keeping forgotten drafts forever.
 */
export const DRAFT_MAX_AGE_MS = 30 * 24 * 3_600_000;

/** `new`, `new:from:<id>` or `edit:<id>`: the draft of a mode, within the diver's drafts. */
export function draftKey(mode: DiveFormMode): string {
  switch (mode.kind) {
    case 'new':
      return 'new';
    case 'duplicate':
      return `new:from:${mode.sourceId}`;
    case 'edit':
      return `edit:${mode.diveId}`;
  }
}

/** `e-deep:dive-draft:<diverId>:<key>`: where the draft `key` of a diver is stored. */
export function storageKeyOf(diverId: string, key: string): string {
  return `${KEY_PREFIX}${diverId}:${key}`;
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

/** Fields the guard checks one by one, its own way (below). */
type OtherField =
  | 'site'
  | 'decoStops'
  | 'team'
  | 'gas'
  | 'tankMaterial'
  | 'suitType'
  | 'entryType'
  | 'timeOfDay'
  | 'weather'
  | 'seaState'
  | 'currentStrength'
  | 'species';

// Compile-time check that the guard covers every field: a field added to `DiveFormValues` without
// its check here would let an older draft through with that field `undefined`.
type UncheckedField = Exclude<
  keyof DiveFormValues,
  (typeof STRING_FIELDS)[number] | (typeof BOOLEAN_FIELDS)[number] | OtherField
>;
const everyFieldChecked: UncheckedField extends never ? true : UncheckedField = true;
void everyFieldChecked;

function isDiveFormIds(value: unknown): value is DiveFormIds {
  return isRecord(value) && isString(value.eventId) && isString(value.newSiteId);
}

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

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Corrupted draft: same as no draft.
    return null;
  }
}

function parseDraft(text: string): DiveDraft | null {
  const data = parseJson(text);
  if (!isRecord(data) || data.version !== DRAFT_VERSION) return null;
  const { savedAt, values, ids } = data;
  return isNumber(savedAt) && isDiveFormValues(values) && isDiveFormIds(ids)
    ? { savedAt, values, ids }
    : null;
}

/**
 * Past `DRAFT_MAX_AGE_MS`, whatever its version. A draft without a readable date (corrupted, or
 * written by a build that had none) cannot be dated: it counts as expired.
 */
function isExpired(text: string, now: number): boolean {
  const data = parseJson(text);
  const savedAt = isRecord(data) ? data.savedAt : undefined;
  return !isNumber(savedAt) || now - savedAt > DRAFT_MAX_AGE_MS;
}

/** Deletes every expired draft of the device, and those without an owner. */
function purgeStale(storage: Storage, now: number): void {
  for (const key of draftStorageKeys(storage)) {
    const text = storage.getItem(key);
    const isUnowned = UNOWNED_KEY.test(key.slice(KEY_PREFIX.length));
    if (text !== null && (isUnowned || isExpired(text, now))) storage.removeItem(key);
  }
}

// ── localStorage ──────────────────────────────────────────────────────────────────────────────

/**
 * The drafts of `diverId` in `localStorage`. Every access is guarded: storage may be disabled
 * (private mode), full or blocked by the browser; a draft is a comfort, its failure never breaks
 * the form. A failed write rejects, so that the form does not claim a draft it does not have.
 * Loading a draft first purges the expired ones (`DRAFT_MAX_AGE_MS`) and the unowned ones.
 *
 * The store belongs to the session it was opened in: after a purge (sign-out, here or in another
 * tab), its writes reject and write nothing.
 */
export function createLocalDraftStore(
  diverId: string,
  storage: Storage | null = safeLocalStorage(),
  now: () => number = Date.now,
): DraftStore {
  const at = (key: string) => storageKeyOf(diverId, key);
  const epoch = readEpochSafely(storage);
  return {
    load(key) {
      try {
        if (storage === null) return Promise.resolve(null);
        purgeStale(storage, now());
        const text = storage.getItem(at(key));
        return Promise.resolve(text === null ? null : parseDraft(text));
      } catch {
        return Promise.resolve(null);
      }
    },
    save(key, draft) {
      try {
        if (storage !== null && readEpoch(storage) !== epoch) {
          return Promise.reject(new Error('Drafts purged since this form opened: not saved.'));
        }
        storage?.setItem(at(key), JSON.stringify({ version: DRAFT_VERSION, ...draft }));
        return Promise.resolve();
      } catch (error) {
        // Quota exceeded or storage blocked: the form keeps working, without the draft mention.
        return Promise.reject(error instanceof Error ? error : new Error('Draft not saved.'));
      }
    },
    clear(key) {
      try {
        storage?.removeItem(at(key));
      } catch {
        // Storage blocked: nothing to clear.
      }
      return Promise.resolve();
    },
  };
}

/** The epoch at the opening of a store; a blocked storage never writes anyway. */
function readEpochSafely(storage: Storage | null): number {
  try {
    return storage === null ? 0 : readEpoch(storage);
  } catch {
    return 0;
  }
}
