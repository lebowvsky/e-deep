// Dive form — validation rules. Pure functions: blocking errors and non-blocking warnings apart.
//
// Bounds: the spec where it sets one, the data model (H-10, H-17, RG-23 to RG-27) elsewhere, and
// never more lenient than the API (its `CHECK`s and column types): what the form lets through, the
// API stores. Every message says what to do, in the spec's « tu ».
import { formatCharacterCount, formatMeasure } from '@/shared/lib/format';
import { parseNumberInput } from '@/shared/lib/numberInput';
import { isSameText } from '@/shared/lib/textMatch';
import { DIVE_FORM_FIELDS, type DiveFormField, type DiveFormValues } from './model';
import { durationFromTimes, parseClock, parseDay, parseInterval } from './timeLink';

export interface ValidationContext {
  /** The device's today, `YYYY-MM-DD`: no dive in the future. */
  today: string;
  /** The diver's level code (`N2`), for the depth warning; `null` when unknown. */
  diverLevel: string | null;
}

export type IssueLevel = 'error' | 'warning';

export interface FieldIssue {
  field: DiveFormField;
  level: IssueLevel;
  message: string;
}

export interface DiveFormIssues {
  /** Blocking, in the order of the form. */
  errors: FieldIssue[];
  /** Non-blocking, in the order of the form. */
  warnings: FieldIssue[];
}

type Rule = (
  values: DiveFormValues,
  context: ValidationContext,
) => Omit<FieldIssue, 'field'> | null;

const error = (message: string) => ({ level: 'error', message }) as const;
const warning = (message: string) => ({ level: 'warning', message }) as const;

// ── Bounds ────────────────────────────────────────────────────────────────────────────────────

export const BOUNDS = {
  durationMin: { min: 1, max: 300 },
  maxDepthM: { min: 1, max: 100 },
  safetyStopDurationMin: { min: 1, max: 15 },
  safetyStopDepthM: { min: 3, max: 6 },
  decoStopDepthM: { min: 1, max: 100 },
  decoStopDurationMin: { min: 1, max: 300 },
  nitroxO2Percent: { min: 22, max: 40 },
  tankVolumeL: { min: 1, max: 30 },
  startPressureBar: { min: 1, max: 300 },
  endPressureBar: { min: 0, max: 300 },
  /** `> 0` in the database: the thinnest suit (lycra) is 0.5 mm. */
  suitThicknessMm: { min: 0.5, max: 15 },
  weightKg: { min: 0, max: 30 },
  airTemperatureC: { min: -40, max: 60 },
  waterTemperatureC: { min: -2, max: 35 },
  visibilityM: { min: 0, max: 100 },
  /** The bottom may be warmer than the surface, by 5 °C at most (spec). */
  bottomAboveSurfaceC: 5,
  siteNameLength: 100,
  memberNameLength: 100,
  /** The whole dive team, the diver included: 49 others at most. */
  teamSize: 50,
  diveCenterLength: 120,
  notesLength: 5000,
  speciesCount: 50,
  speciesLength: 80,
} as const;

/** Depth limits by level of the diver (spec): the warning names the level. */
const LEVEL_DEPTH_LIMITS: Readonly<Record<string, { limitM: number; supervised: boolean }>> = {
  N1: { limitM: 20, supervised: true },
  N2: { limitM: 40, supervised: true },
  N3: { limitM: 60, supervised: false },
  N4: { limitM: 60, supervised: false },
};

// ── Helpers ───────────────────────────────────────────────────────────────────────────────────

type Range = { min: number; max: number };

const within = (value: number, { min, max }: Range) => value >= min && value <= max;

/**
 * Decimals a decimal column keeps (`numeric(x,1)`): the API refuses more (`precision`) rather than
 * round them. Same test as the API's: `12,50` is `12.5`, one decimal.
 */
const DECIMAL_SCALE = 1;

export const ONE_DECIMAL_MESSAGE = 'Garde une seule décimale (par exemple 12,5).';

const hasExtraDecimals = (value: number) => Number(value.toFixed(DECIMAL_SCALE)) !== value;

/**
 * Optional number: `null` when empty, or within `range` and whole (`whole`, integer columns) or
 * with one decimal at most (decimal columns); else `message`, or the decimal one.
 */
function optionalNumber(raw: string, range: Range, message: string, whole = false) {
  const value = parseNumberInput(raw);
  if (raw.trim() === '') return null;
  if (value === null || !within(value, range) || (whole && !Number.isInteger(value))) {
    return error(message);
  }
  return hasExtraDecimals(value) ? error(ONE_DECIMAL_MESSAGE) : null;
}

const degreesRange = (range: Range) =>
  `entre ${formatMeasure(range.min)} et ${formatMeasure(range.max)} °C`;

// ── Rules, one per field ──────────────────────────────────────────────────────────────────────

const RULES: Partial<Record<DiveFormField, Rule>> = {
  site: ({ site }) => {
    const name = site.name.trim();
    if (name === '')
      return error('Choisis un site ou crée-en un nouveau pour enregistrer la plongée.');
    if (name.length > BOUNDS.siteNameLength) {
      return error(`Raccourcis le nom du site (${BOUNDS.siteNameLength} caractères au plus).`);
    }
    return null;
  },

  date: ({ date }, { today }) => {
    if (date.trim() === '') return error('Indique la date de la plongée.');
    if (parseDay(date) === null) return error('Indique une date valide, au format jj/mm/aaaa.');
    // Same format on both sides: the string order is the calendar order.
    if (date > today) return error('La date est dans le futur : indique le jour de la plongée.');
    return null;
  },

  entryTime: ({ entryTime }) => {
    if (entryTime.trim() === '') return error('Indique l’heure d’immersion.');
    return parseClock(entryTime) === null
      ? error('Indique une heure valide, au format hh:mm.')
      : null;
  },

  exitTime: ({ entryTime, exitTime, timeOfDay }) => {
    if (exitTime.trim() === '') return error('Indique l’heure de sortie.');
    if (parseClock(exitTime) === null) return error('Indique une heure valide, au format hh:mm.');
    if (parseClock(entryTime) === null) return null;
    if (durationFromTimes(entryTime, exitTime, timeOfDay === 'NIGHT') === null) {
      return error(
        exitTime === entryTime
          ? `La sortie doit être après l’immersion (${entryTime}).`
          : `La sortie doit être après l’immersion (${entryTime}). Après minuit, choisis le moment Nuit.`,
      );
    }
    return null;
  },

  durationMin: ({ durationMin, entryTime, exitTime, timeOfDay }) => {
    const { min, max } = BOUNDS.durationMin;
    if (durationMin.trim() === '') return error(`Indique la durée, entre ${min} et ${max} min.`);
    const value = parseNumberInput(durationMin);
    if (value === null || !Number.isInteger(value) || !within(value, BOUNDS.durationMin)) {
      return error(`Indique une durée en minutes entières, entre ${min} et ${max} min.`);
    }
    const fromTimes = durationFromTimes(entryTime, exitTime, timeOfDay === 'NIGHT');
    if (fromTimes !== null && fromTimes !== value) {
      return error(
        `La durée ne correspond pas aux heures (${fromTimes} min). Corrige la durée ou la sortie.`,
      );
    }
    return null;
  },

  maxDepthM: ({ maxDepthM }, { diverLevel }) => {
    const { min, max } = BOUNDS.maxDepthM;
    if (maxDepthM.trim() === '') {
      return error(`Indique la profondeur max, entre ${min} et ${max} m.`);
    }
    const value = parseNumberInput(maxDepthM);
    if (value === null || !within(value, BOUNDS.maxDepthM)) {
      return error(`Indique une profondeur entre ${min} et ${max} m.`);
    }
    if (hasExtraDecimals(value)) return error(ONE_DECIMAL_MESSAGE);
    const limit = diverLevel === null ? undefined : LEVEL_DEPTH_LIMITS[diverLevel];
    if (limit !== undefined && value > limit.limitM) {
      const who = limit.supervised ? `${diverLevel} encadré` : `${diverLevel}`;
      return warning(`Au-delà de ${limit.limitM} m, limite d’un ${who}. Vérifie la valeur.`);
    }
    return null;
  },

  safetyStopDurationMin: ({ safetyStop, safetyStopDurationMin, durationMin }) => {
    if (!safetyStop) return null;
    const { min, max } = BOUNDS.safetyStopDurationMin;
    const message = `Indique une durée de palier en minutes entières, entre ${min} et ${max} min, ou désactive le palier.`;
    if (safetyStopDurationMin.trim() === '') return error(message);
    const invalid = optionalNumber(
      safetyStopDurationMin,
      BOUNDS.safetyStopDurationMin,
      message,
      true,
    );
    if (invalid) return invalid;
    // RG-25: shorter than the dive.
    const stop = parseNumberInput(safetyStopDurationMin);
    const dive = parseNumberInput(durationMin);
    if (stop !== null && dive !== null && stop >= dive) {
      return error(`Le palier doit durer moins que la plongée (${formatMeasure(dive)} min).`);
    }
    return null;
  },

  safetyStopDepthM: ({ safetyStop, safetyStopDepthM, maxDepthM }) => {
    if (!safetyStop) return null;
    const { min, max } = BOUNDS.safetyStopDepthM;
    const message = `Indique une profondeur de palier entre ${min} et ${max} m, ou désactive le palier.`;
    if (safetyStopDepthM.trim() === '') return error(message);
    const invalid = optionalNumber(safetyStopDepthM, BOUNDS.safetyStopDepthM, message);
    if (invalid) return invalid;
    // RG-25: no deeper than the dive.
    const stop = parseNumberInput(safetyStopDepthM);
    const dive = parseNumberInput(maxDepthM);
    if (stop !== null && dive !== null && stop > dive) {
      return error(
        `Le palier ne peut pas être plus profond que la plongée (${formatMeasure(dive)} m).`,
      );
    }
    return null;
  },

  decoStops: ({ decompression, decoStops }) => {
    if (!decompression) return null;
    const isValid = (raw: string, range: Range) => {
      const value = parseNumberInput(raw);
      return value !== null && within(value, range);
    };
    const complete = decoStops.every(
      (stop) =>
        isValid(stop.depthM, BOUNDS.decoStopDepthM) &&
        isValid(stop.durationMin, BOUNDS.decoStopDurationMin),
    );
    return complete
      ? null
      : error('Indique la profondeur et la durée de chaque palier, ou retire la ligne.');
  },

  surfaceInterval: ({ repetitive, surfaceInterval }) => {
    if (!repetitive || surfaceInterval.trim() === '') return null;
    const minutes = parseInterval(surfaceInterval);
    return minutes === null || minutes === 0
      ? error('Indique l’intervalle au format h:mm (par exemple 1:30), ou laisse-le vide.')
      : null;
  },

  team: ({ team }) => {
    const incomplete = team.find(
      (member) => member.firstName.trim() === '' || member.lastName.trim() === '',
    );
    if (incomplete) return error('Indique le prénom et le nom de chaque plongeur de la palanquée.');
    // The diver is implied: the others are one fewer than the team.
    if (team.length >= BOUNDS.teamSize) {
      return error(
        `Retire des plongeurs : la palanquée compte ${BOUNDS.teamSize} plongeurs au plus, toi compris.`,
      );
    }
    const tooLong = team.some(
      (member) =>
        member.firstName.trim().length > BOUNDS.memberNameLength ||
        member.lastName.trim().length > BOUNDS.memberNameLength,
    );
    return tooLong
      ? error(`Raccourcis les noms des plongeurs (${BOUNDS.memberNameLength} caractères au plus).`)
      : null;
  },

  o2Percent: ({ gas, o2Percent }) => {
    if (gas !== 'NITROX') return null;
    const { min, max } = BOUNDS.nitroxO2Percent;
    const message = `Indique un % d’O₂ entre ${min} et ${max} pour le Nitrox.`;
    return o2Percent.trim() === ''
      ? error(message)
      : optionalNumber(o2Percent, BOUNDS.nitroxO2Percent, message);
  },

  tankVolumeL: ({ tankVolumeL }) => {
    const { min, max } = BOUNDS.tankVolumeL;
    return optionalNumber(
      tankVolumeL,
      BOUNDS.tankVolumeL,
      `Indique un bloc entre ${min} et ${max} L.`,
    );
  },

  startPressureBar: ({ startPressureBar }) => {
    const { min, max } = BOUNDS.startPressureBar;
    return optionalNumber(
      startPressureBar,
      BOUNDS.startPressureBar,
      `Indique une pression de début en bar entiers, entre ${min} et ${max} bar.`,
      true,
    );
  },

  endPressureBar: ({ startPressureBar, endPressureBar }) => {
    const { min, max } = BOUNDS.endPressureBar;
    const invalid = optionalNumber(
      endPressureBar,
      BOUNDS.endPressureBar,
      `Indique une pression de fin en bar entiers, entre ${min} et ${max} bar.`,
      true,
    );
    if (invalid) return invalid;
    const start = parseNumberInput(startPressureBar);
    const end = parseNumberInput(endPressureBar);
    if (start !== null && end !== null && end >= start) {
      return error(
        `La pression de fin doit être inférieure à la pression de début (${formatMeasure(start)} bar).`,
      );
    }
    return null;
  },

  suitThicknessMm: ({ suitThicknessMm }) => {
    const { min, max } = BOUNDS.suitThicknessMm;
    return optionalNumber(
      suitThicknessMm,
      BOUNDS.suitThicknessMm,
      `Indique une épaisseur entre ${formatMeasure(min)} et ${formatMeasure(max)} mm.`,
    );
  },

  weightKg: ({ weightKg }) => {
    const { min, max } = BOUNDS.weightKg;
    return optionalNumber(weightKg, BOUNDS.weightKg, `Indique un lest entre ${min} et ${max} kg.`);
  },

  diveCenter: ({ diveCenter }) =>
    diveCenter.trim().length > BOUNDS.diveCenterLength
      ? error(`Raccourcis le nom de la structure (${BOUNDS.diveCenterLength} caractères au plus).`)
      : null,

  airTemperatureC: ({ airTemperatureC }) =>
    optionalNumber(
      airTemperatureC,
      BOUNDS.airTemperatureC,
      `Indique une température de l’air ${degreesRange(BOUNDS.airTemperatureC)}.`,
    ),

  surfaceTemperatureC: ({ surfaceTemperatureC }) =>
    optionalNumber(
      surfaceTemperatureC,
      BOUNDS.waterTemperatureC,
      `Indique une température de l’eau ${degreesRange(BOUNDS.waterTemperatureC)}.`,
    ),

  bottomTemperatureC: ({ surfaceTemperatureC, bottomTemperatureC }) => {
    const invalid = optionalNumber(
      bottomTemperatureC,
      BOUNDS.waterTemperatureC,
      `Indique une température de l’eau ${degreesRange(BOUNDS.waterTemperatureC)}.`,
    );
    if (invalid) return invalid;
    const surface = parseNumberInput(surfaceTemperatureC);
    const bottom = parseNumberInput(bottomTemperatureC);
    if (surface !== null && bottom !== null && bottom > surface + BOUNDS.bottomAboveSurfaceC) {
      return error(
        `L’eau au fond ne peut pas dépasser la surface de plus de ${BOUNDS.bottomAboveSurfaceC} °C. Vérifie les deux valeurs.`,
      );
    }
    return null;
  },

  visibilityM: ({ visibilityM }) => {
    const { min, max } = BOUNDS.visibilityM;
    return optionalNumber(
      visibilityM,
      BOUNDS.visibilityM,
      `Indique une visibilité en mètres entiers, entre ${min} et ${max} m.`,
      true,
    );
  },

  notes: ({ notes }) =>
    notes.trim().length > BOUNDS.notesLength
      ? error(`Raccourcis tes notes (${formatCharacterCount(BOUNDS.notesLength)} au plus).`)
      : null,

  species: ({ species }) => {
    if (species.length > BOUNDS.speciesCount) {
      return error(`Garde ${BOUNDS.speciesCount} espèces au plus.`);
    }
    const tooLong = species.find((label) => label.trim().length > BOUNDS.speciesLength);
    if (tooLong !== undefined) {
      return error(
        `Raccourcis « ${tooLong.trim()} » (${BOUNDS.speciesLength} caractères au plus).`,
      );
    }
    // RG-27: a species once per dive. « Same » as the tags field: case and accents aside.
    const hasDuplicate = species.some((label, index) =>
      species.slice(0, index).some((other) => isSameText(other, label)),
    );
    return hasDuplicate ? error('Retire les espèces en double.') : null;
  },
};

/** The fields of `issues`, in their order: error summary and first focus. */
export function issueFields(issues: readonly FieldIssue[]): DiveFormField[] {
  return issues.map(({ field }) => field);
}

/** The issue of one field (blur, live validation), `null` when it is fine. */
export function validateField(
  field: DiveFormField,
  values: DiveFormValues,
  context: ValidationContext,
): FieldIssue | null {
  const issue = RULES[field]?.(values, context) ?? null;
  return issue === null ? null : { field, ...issue };
}

/** Every issue, errors and warnings apart, in the order of the form (summary, first focus). */
export function validateDiveForm(
  values: DiveFormValues,
  context: ValidationContext,
): DiveFormIssues {
  const issues = DIVE_FORM_FIELDS.map((field) => validateField(field, values, context)).filter(
    (issue) => issue !== null,
  );
  return {
    errors: issues.filter((issue) => issue.level === 'error'),
    warnings: issues.filter((issue) => issue.level === 'warning'),
  };
}

/**
 * Fields whose rule reads another field: when `field` changes, they are checked again (only those
 * already showing a message, see the reducer).
 */
export const DEPENDENT_FIELDS: Partial<Record<DiveFormField, readonly DiveFormField[]>> = {
  entryTime: ['exitTime', 'durationMin'],
  exitTime: ['durationMin'],
  durationMin: ['exitTime', 'safetyStopDurationMin'],
  timeOfDay: ['exitTime', 'durationMin'],
  maxDepthM: ['safetyStopDepthM'],
  safetyStop: ['safetyStopDurationMin', 'safetyStopDepthM'],
  decompression: ['decoStops'],
  repetitive: ['surfaceInterval'],
  gas: ['o2Percent'],
  startPressureBar: ['endPressureBar'],
  surfaceTemperatureC: ['bottomTemperatureC'],
};
