// Dive form (« Nouvelle plongée » / « Dupliquer » / « Modifier ») — raw values as typed.
//
// Text and number fields keep the string the diver typed (« 12,5 », « » when empty): parsing
// happens in validation and conversion, never while typing. Switches are booleans, segmented
// controls are unions (`null` = nothing chosen yet).
import type {
  CurrentStrength,
  EntryType,
  SeaState,
  SuitType,
  TankMaterial,
  TimeOfDay,
  Weather,
} from '@e-deep/shared';

/** The form offers two gases; `OTHER` mixes come back as Nitrox with their own share. */
export type GasChoice = 'AIR' | 'NITROX';

/** A site of the log (`id`), or one created on the fly by its name (`id: null`). */
export interface SiteValue {
  id: string | null;
  name: string;
}

/**
 * Another member of the dive team (the diver is implied and never listed). `id: null` for a diver
 * created by their name. `key` identifies the row in the list, created or not.
 */
export interface TeamMemberValue {
  key: string;
  id: string | null;
  firstName: string;
  lastName: string;
  /** Level code (`N2`, `PA40`…), `''` when unknown. */
  level: string;
}

/** A decompression stop row: not in the data model yet (D-16), kept by the form only. */
export interface DecoStopValue {
  key: string;
  depthM: string;
  durationMin: string;
}

export interface DiveFormValues {
  // 1. L'essentiel
  site: SiteValue;
  /** Logbook number: computed by the API (D26), the form only checks it against the log. */
  number: string;
  /** `YYYY-MM-DD` (native date input). */
  date: string;
  /** `HH:MM` (native time inputs). */
  entryTime: string;
  exitTime: string;
  durationMin: string;
  maxDepthM: string;
  // 2. Déroulé
  safetyStop: boolean;
  safetyStopDurationMin: string;
  safetyStopDepthM: string;
  /** « Paliers respectés » (D-11): required by the model, absent from the spec (open point). */
  stopsOk: boolean;
  decompression: boolean;
  decoStops: DecoStopValue[];
  repetitive: boolean;
  /** `h:mm`; not stored by the model (D-17). */
  surfaceInterval: string;
  // 3. Palanquée
  team: TeamMemberValue[];
  // 4. Équipement & gaz
  gas: GasChoice;
  /** Only read with Nitrox (Air is 21 %). */
  o2Percent: string;
  tankVolumeL: string;
  tankMaterial: TankMaterial | null;
  startPressureBar: string;
  endPressureBar: string;
  suitThicknessMm: string;
  suitType: SuitType | null;
  weightKg: string;
  // 5. Conditions
  entryType: EntryType | null;
  timeOfDay: TimeOfDay | null;
  diveCenter: string;
  weather: Weather | null;
  airTemperatureC: string;
  seaState: SeaState | null;
  currentStrength: CurrentStrength | null;
  surfaceTemperatureC: string;
  bottomTemperatureC: string;
  visibilityM: string;
  // 6. Notes & observations
  notes: string;
  species: string[];
}

export type DiveFormField = keyof DiveFormValues;

/** Every field, in the order of the form: error summary, focus of the first error. */
export const DIVE_FORM_FIELDS = [
  'site',
  'number',
  'date',
  'entryTime',
  'exitTime',
  'durationMin',
  'maxDepthM',
  'safetyStop',
  'safetyStopDurationMin',
  'safetyStopDepthM',
  'stopsOk',
  'decompression',
  'decoStops',
  'repetitive',
  'surfaceInterval',
  'team',
  'gas',
  'o2Percent',
  'tankVolumeL',
  'tankMaterial',
  'startPressureBar',
  'endPressureBar',
  'suitThicknessMm',
  'suitType',
  'weightKg',
  'entryType',
  'timeOfDay',
  'diveCenter',
  'weather',
  'airTemperatureC',
  'seaState',
  'currentStrength',
  'surfaceTemperatureC',
  'bottomTemperatureC',
  'visibilityM',
  'notes',
  'species',
] as const satisfies readonly DiveFormField[];

// Compile-time check that the list above names every field of `DiveFormValues`.
type MissingField = Exclude<DiveFormField, (typeof DIVE_FORM_FIELDS)[number]>;
const everyFieldListed: MissingField extends never ? true : MissingField = true;
void everyFieldListed;

export const DIVE_FORM_SECTIONS = [
  'essential',
  'run',
  'team',
  'equipment',
  'conditions',
  'notes',
] as const;
export type DiveFormSection = (typeof DIVE_FORM_SECTIONS)[number];

export const SECTION_TITLES: Record<DiveFormSection, string> = {
  essential: 'L’essentiel',
  run: 'Déroulé',
  team: 'Palanquée',
  equipment: 'Équipement & gaz',
  conditions: 'Conditions',
  notes: 'Notes & observations',
};

export const FIELD_SECTIONS: Record<DiveFormField, DiveFormSection> = {
  site: 'essential',
  number: 'essential',
  date: 'essential',
  entryTime: 'essential',
  exitTime: 'essential',
  durationMin: 'essential',
  maxDepthM: 'essential',
  safetyStop: 'run',
  safetyStopDurationMin: 'run',
  safetyStopDepthM: 'run',
  stopsOk: 'run',
  decompression: 'run',
  decoStops: 'run',
  repetitive: 'run',
  surfaceInterval: 'run',
  team: 'team',
  gas: 'equipment',
  o2Percent: 'equipment',
  tankVolumeL: 'equipment',
  tankMaterial: 'equipment',
  startPressureBar: 'equipment',
  endPressureBar: 'equipment',
  suitThicknessMm: 'equipment',
  suitType: 'equipment',
  weightKg: 'equipment',
  entryType: 'conditions',
  timeOfDay: 'conditions',
  diveCenter: 'conditions',
  weather: 'conditions',
  airTemperatureC: 'conditions',
  seaState: 'conditions',
  currentStrength: 'conditions',
  surfaceTemperatureC: 'conditions',
  bottomTemperatureC: 'conditions',
  visibilityM: 'conditions',
  notes: 'notes',
  species: 'notes',
};

/** Visible labels: error summary links, « − Pression fin » of the section summary. */
export const FIELD_LABELS: Record<DiveFormField, string> = {
  site: 'Site',
  number: 'N° de plongée',
  date: 'Date',
  entryTime: 'Immersion',
  exitTime: 'Sortie',
  durationMin: 'Durée',
  maxDepthM: 'Profondeur max',
  safetyStop: 'Palier de sécurité',
  safetyStopDurationMin: 'Durée du palier',
  safetyStopDepthM: 'Profondeur du palier',
  stopsOk: 'Paliers respectés',
  decompression: 'Paliers de décompression',
  decoStops: 'Paliers de décompression',
  repetitive: 'Plongée successive',
  surfaceInterval: 'Intervalle de surface',
  team: 'Palanquée',
  gas: 'Gaz',
  o2Percent: '% O₂',
  tankVolumeL: 'Bloc',
  tankMaterial: 'Matériau',
  startPressureBar: 'Pression début',
  endPressureBar: 'Pression fin',
  suitThicknessMm: 'Combinaison',
  suitType: 'Type de combinaison',
  weightKg: 'Lest',
  entryType: 'Mise à l’eau',
  timeOfDay: 'Moment',
  diveCenter: 'Structure',
  weather: 'Météo',
  airTemperatureC: 'Air',
  seaState: 'Mer',
  currentStrength: 'Courant',
  surfaceTemperatureC: 'Eau surface',
  bottomTemperatureC: 'Eau fond',
  visibilityM: 'Visibilité',
  notes: 'Notes',
  species: 'Espèces',
};

/**
 * Who owns each field. `event` fields are shared by the dive team and edited by the creator only
 * (RG-29); the others belong to the diver's participation.
 *
 * Follows the data model (D-04, D-08, D-10), which ARCHITECTURE.md keeps over the spec: the start
 * (date and immersion) is on the event, the dive team is on the participation. The spec marks
 * them the other way round (open point 18 of the data model).
 */
export type FieldScope = 'event' | 'participation';

const EVENT_FIELDS: ReadonlySet<DiveFormField> = new Set<DiveFormField>([
  'site',
  'date',
  'entryTime',
  'entryType',
  'timeOfDay',
  'diveCenter',
  'weather',
  'airTemperatureC',
  'seaState',
  'currentStrength',
]);

export function fieldScope(field: DiveFormField): FieldScope {
  return EVENT_FIELDS.has(field) ? 'event' : 'participation';
}

/** `canEditEvent` false (future club use): the event fields are read only. */
export function isFieldEditable(field: DiveFormField, canEditEvent: boolean): boolean {
  return canEditEvent || fieldScope(field) === 'participation';
}

/** Required fields (« * »): the whole of « L'essentiel » but the logbook number. */
export const REQUIRED_FIELDS: readonly DiveFormField[] = [
  'site',
  'date',
  'entryTime',
  'exitTime',
  'durationMin',
  'maxDepthM',
];

/** Levels offered for a member of the dive team (FFESSM). */
export const TEAM_LEVELS = [
  { code: 'N1', label: 'Niveau 1' },
  { code: 'N2', label: 'Niveau 2' },
  { code: 'N3', label: 'Niveau 3' },
  { code: 'N4', label: 'Niveau 4' },
  { code: 'PA20', label: 'Plongeur autonome 20 m' },
  { code: 'PA40', label: 'Plongeur autonome 40 m' },
  { code: 'PA60', label: 'Plongeur autonome 60 m' },
  { code: 'PE20', label: 'Plongeur encadré 20 m' },
  { code: 'PE40', label: 'Plongeur encadré 40 m' },
  { code: 'PE60', label: 'Plongeur encadré 60 m' },
] as const;

/** Safety stop proposed when the switch is turned on (spec). */
export const SAFETY_STOP_DEFAULTS = { durationMin: '3', depthM: '5' } as const;

/** Oxygen share of air, shown locked when the gas is Air. */
export const AIR_O2_PERCENT = 21;

/** Nothing entered. */
export function emptyDiveFormValues(): DiveFormValues {
  return {
    site: { id: null, name: '' },
    number: '',
    date: '',
    entryTime: '',
    exitTime: '',
    durationMin: '',
    maxDepthM: '',
    safetyStop: false,
    safetyStopDurationMin: '',
    safetyStopDepthM: '',
    stopsOk: false,
    decompression: false,
    decoStops: [],
    repetitive: false,
    surfaceInterval: '',
    team: [],
    gas: 'AIR',
    o2Percent: '',
    tankVolumeL: '',
    tankMaterial: null,
    startPressureBar: '',
    endPressureBar: '',
    suitThicknessMm: '',
    suitType: null,
    weightKg: '',
    entryType: null,
    timeOfDay: null,
    diveCenter: '',
    weather: null,
    airTemperatureC: '',
    seaState: null,
    currentStrength: null,
    surfaceTemperatureC: '',
    bottomTemperatureC: '',
    visibilityM: '',
    notes: '',
    species: [],
  };
}

/** Structural equality of plain form data (strings, booleans, `null`, arrays, records). */
export function isSameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => isSameValue(item, b[index]));
  }
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    if (Array.isArray(a) || Array.isArray(b)) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    return (
      keysA.length === keysB.length &&
      keysA.every((key) => isSameValue(Reflect.get(a, key), Reflect.get(b, key)))
    );
  }
  return false;
}

/** The form differs from the values it was opened with. */
export function isDirtyValues(values: DiveFormValues, initial: DiveFormValues): boolean {
  return DIVE_FORM_FIELDS.some((field) => !isSameValue(values[field], initial[field]));
}
