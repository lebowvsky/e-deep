// Field errors of the API (`fieldErrors`: body path → constraint codes, D-26) → fields and
// messages of the dive form.
//
// The form validates before sending, with bounds at least as strict as the API's: a field the API
// still refuses is a rare mismatch. Its message is the one the form gives for that field (same
// words, same bounds), or the one of the specific rule the code names.
import type { ApiFieldErrors } from '@e-deep/shared';
import { formatCharacterCount, formatMeasure } from '@/shared/lib/format';
import type { DiveFormField } from '../form/model';
import { BOUNDS, ONE_DECIMAL_MESSAGE } from '../form/validation';

export type DiveFormFieldErrors = Partial<Record<DiveFormField, string>>;

interface FieldTranslation {
  field: DiveFormField;
  message: string;
  /** Messages of the rules named by a code (`before-duration`), over `message`. */
  byCode?: Readonly<Record<string, string>>;
}

const range = (min: number, max: number, unit: string) =>
  `entre ${formatMeasure(min)} et ${formatMeasure(max)} ${unit}`;
const degrees = range(BOUNDS.waterTemperatureC.min, BOUNDS.waterTemperatureC.max, '°C');

/** A `numeric(x,1)` column: more than one decimal is refused with `precision`. */
const decimal = (
  field: DiveFormField,
  message: string,
  byCode: Readonly<Record<string, string>> = {},
): FieldTranslation => ({ field, message, byCode: { precision: ONE_DECIMAL_MESSAGE, ...byCode } });

/** A `smallint` column: a decimal is refused with `integer`, the field's message says so. */
const whole = (
  field: DiveFormField,
  message: string,
  byCode: Readonly<Record<string, string>> = {},
): FieldTranslation => ({ field, message, byCode: { integer: message, ...byCode } });

const SITE: FieldTranslation = {
  field: 'site',
  message: 'Choisis un site ou crée-en un nouveau pour enregistrer la plongée.',
  byCode: {
    length: `Raccourcis le nom du site (${BOUNDS.siteNameLength} caractères au plus).`,
  },
};

const START: FieldTranslation = {
  field: 'date',
  message: 'Vérifie la date et l’heure d’immersion de la plongée.',
  byCode: {
    // The offset of `startedAt` is not `utcOffsetMinutes`: both come from the device's time zone.
    'matches-offset':
      'L’heure d’immersion ne correspond pas au fuseau de l’appareil. Vérifie la date et l’heure, puis réessaie.',
  },
};

const TEAM: FieldTranslation = {
  field: 'team',
  message: 'Indique le prénom et le nom de chaque plongeur de la palanquée.',
  byCode: {
    length: `Raccourcis les noms des plongeurs (${BOUNDS.memberNameLength} caractères au plus).`,
    duplicate: 'Retire le plongeur présent deux fois dans la palanquée.',
    'too-many': `Retire des plongeurs : la palanquée compte ${BOUNDS.teamSize} plongeurs au plus, toi compris.`,
  },
};

const SPECIES: FieldTranslation = {
  field: 'species',
  message: `Raccourcis les espèces (${BOUNDS.speciesLength} caractères au plus).`,
  byCode: {
    duplicate: 'Retire les espèces en double.',
    'too-many': `Garde ${BOUNDS.speciesCount} espèces au plus.`,
  },
};

/** RG-25: the safety stop has both values, or none. */
const STOP_PAIR = 'Indique la durée et la profondeur du palier, ou désactive le palier.';

const GAS: FieldTranslation = { field: 'gas', message: 'Choisis le gaz de la plongée.' };

/** By path, list indices left out (`observations.3.label` → `observations`). */
const TRANSLATIONS: Readonly<Record<string, FieldTranslation>> = {
  site: SITE,
  'event.siteId': SITE,
  'event.startedAt': START,
  'event.utcOffsetMinutes': START,
  'event.entryType': { field: 'entryType', message: 'Choisis la mise à l’eau : Bateau ou Bord.' },
  'event.timeOfDay': { field: 'timeOfDay', message: 'Choisis le moment de la plongée.' },
  'event.weather': { field: 'weather', message: 'Choisis la météo dans la liste.' },
  'event.airTemperatureC': decimal(
    'airTemperatureC',
    `Indique une température de l’air ${range(BOUNDS.airTemperatureC.min, BOUNDS.airTemperatureC.max, '°C')}.`,
  ),
  'event.seaState': { field: 'seaState', message: 'Choisis l’état de la mer.' },
  'event.currentStrength': { field: 'currentStrength', message: 'Choisis la force du courant.' },
  'event.diveCenter': {
    field: 'diveCenter',
    message: `Raccourcis le nom de la structure (${BOUNDS.diveCenterLength} caractères au plus).`,
  },
  'participation.maxDepthM': decimal(
    'maxDepthM',
    `Indique une profondeur ${range(BOUNDS.maxDepthM.min, BOUNDS.maxDepthM.max, 'm')}.`,
  ),
  'participation.durationMin': whole(
    'durationMin',
    `Indique une durée en minutes entières, ${range(BOUNDS.durationMin.min, BOUNDS.durationMin.max, 'min')}.`,
  ),
  'participation.waterTemperatureC': decimal(
    'bottomTemperatureC',
    `Indique une température de l’eau ${degrees}.`,
  ),
  'participation.surfaceWaterTemperatureC': decimal(
    'surfaceTemperatureC',
    `Indique une température de l’eau ${degrees}.`,
  ),
  'participation.visibilityM': whole(
    'visibilityM',
    `Indique une visibilité en mètres entiers, ${range(BOUNDS.visibilityM.min, BOUNDS.visibilityM.max, 'm')}.`,
  ),
  'participation.gasMix': GAS,
  'participation.o2Percent': decimal(
    'o2Percent',
    `Indique un % d’O₂ entre ${BOUNDS.nitroxO2Percent.min} et ${BOUNDS.nitroxO2Percent.max} pour le Nitrox.`,
    { 'o2-other-only': 'Le % d’O₂ ne s’indique que pour le Nitrox.' },
  ),
  'participation.hasDecompression': {
    field: 'decompression',
    message: 'Indique si la plongée a demandé des paliers de décompression.',
  },
  'participation.stopsOk': {
    field: 'stopsOk',
    message: 'Indique si les paliers ont été respectés.',
  },
  'participation.isRepetitive': {
    field: 'repetitive',
    message: 'Indique si la plongée est successive.',
  },
  'participation.notes': {
    field: 'notes',
    message: `Raccourcis tes notes (${formatCharacterCount(BOUNDS.notesLength)} au plus).`,
  },
  'participation.safetyStopDurationMin': whole(
    'safetyStopDurationMin',
    `Indique une durée de palier en minutes entières, ${range(BOUNDS.safetyStopDurationMin.min, BOUNDS.safetyStopDurationMin.max, 'min')}, ou désactive le palier.`,
    { 'before-duration': 'Le palier doit durer moins que la plongée.', pair: STOP_PAIR },
  ),
  'participation.safetyStopDepthM': decimal(
    'safetyStopDepthM',
    `Indique une profondeur de palier ${range(BOUNDS.safetyStopDepthM.min, BOUNDS.safetyStopDepthM.max, 'm')}, ou désactive le palier.`,
    {
      'above-max-depth': 'Le palier ne peut pas être plus profond que la plongée.',
      pair: STOP_PAIR,
    },
  ),
  'participation.tankVolumeL': decimal(
    'tankVolumeL',
    `Indique un bloc ${range(BOUNDS.tankVolumeL.min, BOUNDS.tankVolumeL.max, 'L')}.`,
  ),
  'participation.tankMaterial': { field: 'tankMaterial', message: 'Choisis le matériau du bloc.' },
  'participation.startPressureBar': whole(
    'startPressureBar',
    `Indique une pression de début en bar entiers, ${range(BOUNDS.startPressureBar.min, BOUNDS.startPressureBar.max, 'bar')}.`,
  ),
  'participation.endPressureBar': whole(
    'endPressureBar',
    `Indique une pression de fin en bar entiers, ${range(BOUNDS.endPressureBar.min, BOUNDS.endPressureBar.max, 'bar')}.`,
    { 'above-start-pressure': 'La pression de fin doit être inférieure à la pression de début.' },
  ),
  'participation.suitType': { field: 'suitType', message: 'Choisis le type de combinaison.' },
  'participation.suitThicknessMm': decimal(
    'suitThicknessMm',
    `Indique une épaisseur ${range(BOUNDS.suitThicknessMm.min, BOUNDS.suitThicknessMm.max, 'mm')}.`,
  ),
  'participation.weightKg': decimal(
    'weightKg',
    `Indique un lest ${range(BOUNDS.weightKg.min, BOUNDS.weightKg.max, 'kg')}.`,
  ),
  observations: SPECIES,
  buddies: TEAM,
};

/** The paths of a list or of the site group under their root: `buddies.0.lastName` → `buddies`. */
const GROUPED_ROOTS: ReadonlySet<string> = new Set(['site', 'buddies', 'observations']);

function translationKey(path: string): string {
  const [root = path] = path.split('.');
  return GROUPED_ROOTS.has(root) ? root : path;
}

/** The message of the first code that names a rule, else the field's own. */
function messageOf({ message, byCode = {} }: FieldTranslation, codes: readonly string[]): string {
  for (const code of codes) {
    const specific = byCode[code];
    if (specific !== undefined) return specific;
  }
  return message;
}

/**
 * The form fields that `fieldErrors` points at, one message each (the first path wins), or `null`
 * when none of the paths is a form field (`event.id`, `baseUpdatedAt`: a bug, not the diver's to
 * fix).
 */
export function toDiveFormFieldErrors(fieldErrors: ApiFieldErrors): DiveFormFieldErrors | null {
  const result: DiveFormFieldErrors = {};
  for (const [path, codes] of Object.entries(fieldErrors)) {
    const translation = TRANSLATIONS[translationKey(path)];
    if (translation !== undefined) result[translation.field] ??= messageOf(translation, codes);
  }
  return Object.keys(result).length === 0 ? null : result;
}

/** Business errors that name a list of the form (D-26, `400` with a code). */
export const DOMAIN_CODE_ERRORS: Readonly<Record<string, DiveFormFieldErrors>> = {
  'duplicate-observation': { species: messageOf(SPECIES, ['duplicate']) },
  'too-many-observations': { species: messageOf(SPECIES, ['too-many']) },
};
