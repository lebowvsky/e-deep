// Dive form — what the page derives from the values: bar used, state and summary of each section,
// live preview. Computed on every render, never stored.
import { formatMeasure, formatSpeciesCount } from '@/shared/lib/format';
import { parseNumberInput } from '@/shared/lib/numberInput';
import { consumedBar } from '../lib/diveFacts';
import { formatDiveLongDate } from '../lib/diveTime';
import {
  CURRENT_STRENGTH_LABELS,
  ENTRY_TYPE_LABELS,
  gasMixSpoken,
  SEA_STATE_LABELS,
} from '../lib/labels';
import { toGasMix } from './convert';
import {
  FIELD_LABELS,
  type DiveFormField,
  type DiveFormSection,
  type DiveFormValues,
} from './model';
import type { DiveFormSiteOption } from './sources';
import { parseDay } from './timeLink';

const num = parseNumberInput;
const filled = (value: string) => value.trim() !== '';

/** « → bar consommés »: start − end, `null` unless both are entered and consistent. */
export function consumedBarOf(values: Pick<DiveFormValues, 'startPressureBar' | 'endPressureBar'>) {
  return consumedBar(num(values.startPressureBar), num(values.endPressureBar));
}

// ── Section state (sommaire: ✓ · ◐ « − Pression fin » · ○) ───────────────────────────────────

export type SectionStatus =
  | { status: 'complete' }
  /** `missing`: label of the first field left empty, in the order of the form. */
  | { status: 'partial'; missing: string }
  | { status: 'empty' };

/** The fields a section expects, each with its own idea of « entered », in the order of the form. */
type Expected = readonly (readonly [DiveFormField, boolean])[];

function expectedFields(section: DiveFormSection, values: DiveFormValues): Expected {
  switch (section) {
    case 'essential':
      return [
        ['site', filled(values.site.name)],
        ['date', filled(values.date)],
        ['entryTime', filled(values.entryTime)],
        ['exitTime', filled(values.exitTime)],
        ['durationMin', filled(values.durationMin)],
        ['maxDepthM', filled(values.maxDepthM)],
      ];
    case 'run':
      // A switch left off is an answer (« Non »); a switch on expects its own fields.
      return [
        ...(values.safetyStop
          ? ([
              ['safetyStopDurationMin', filled(values.safetyStopDurationMin)],
              ['safetyStopDepthM', filled(values.safetyStopDepthM)],
            ] as const)
          : []),
        ...(values.decompression
          ? ([
              [
                'decoStops',
                values.decoStops.length > 0 &&
                  values.decoStops.every((stop) => filled(stop.depthM) && filled(stop.durationMin)),
              ],
            ] as const)
          : []),
        ...(values.repetitive
          ? ([['surfaceInterval', filled(values.surfaceInterval)]] as const)
          : []),
      ];
    case 'team':
      return [['team', values.team.length > 0]];
    case 'equipment':
      return [
        // Air is the default, not an entry: the gas only counts once Nitrox is chosen.
        ...(values.gas === 'NITROX'
          ? ([
              ['gas', true],
              ['o2Percent', filled(values.o2Percent)],
            ] as const)
          : []),
        ['tankVolumeL', filled(values.tankVolumeL)],
        ['tankMaterial', values.tankMaterial !== null],
        ['startPressureBar', filled(values.startPressureBar)],
        ['endPressureBar', filled(values.endPressureBar)],
        ['suitThicknessMm', filled(values.suitThicknessMm)],
        ['suitType', values.suitType !== null],
        ['weightKg', filled(values.weightKg)],
      ];
    case 'conditions':
      return [
        ['entryType', values.entryType !== null],
        ['timeOfDay', values.timeOfDay !== null],
        ['diveCenter', filled(values.diveCenter)],
        ['weather', values.weather !== null],
        ['airTemperatureC', filled(values.airTemperatureC)],
        ['seaState', values.seaState !== null],
        ['currentStrength', values.currentStrength !== null],
        ['surfaceTemperatureC', filled(values.surfaceTemperatureC)],
        ['bottomTemperatureC', filled(values.bottomTemperatureC)],
        ['visibilityM', filled(values.visibilityM)],
      ];
    case 'notes':
      return [
        ['notes', filled(values.notes)],
        ['species', values.species.length > 0],
      ];
  }
}

/** Complete, partial (with the first missing field) or empty. */
export function sectionStatus(section: DiveFormSection, values: DiveFormValues): SectionStatus {
  const expected = expectedFields(section, values);
  const missing = expected.find(([, isFilled]) => !isFilled);
  if (missing === undefined) {
    // The run section with every switch off: nothing was said about it yet.
    return expected.length === 0 ? { status: 'empty' } : { status: 'complete' };
  }
  if (expected.every(([, isFilled]) => !isFilled)) return { status: 'empty' };
  return { status: 'partial', missing: FIELD_LABELS[missing[0]] };
}

// ── Summary of a folded section (mobile accordion) ────────────────────────────────────────────

export const EMPTY_SECTION_SUMMARY = 'Rien pour l’instant';

const join = (parts: readonly (string | null)[]) =>
  parts.filter((part): part is string => part !== null).join(' · ');

const measure = (raw: string, unit: string) => {
  const value = num(raw);
  return value === null ? null : `${formatMeasure(value)} ${unit}`;
};

function runSummary(values: DiveFormValues): string {
  const stopDuration = num(values.safetyStopDurationMin);
  const stopDepth = num(values.safetyStopDepthM);
  return join([
    values.safetyStop && stopDuration !== null && stopDepth !== null
      ? `Palier de sécurité ${formatMeasure(stopDuration)} min à ${formatMeasure(stopDepth)} m`
      : values.safetyStop
        ? 'Palier de sécurité'
        : null,
    values.decompression ? 'Paliers de déco.' : null,
    values.repetitive
      ? join(['Successive', filled(values.surfaceInterval) ? values.surfaceInterval.trim() : null])
      : null,
  ]);
}

function teamSummary(values: DiveFormValues): string {
  if (values.team.length === 0) return '';
  const names = values.team.map((member) => `${member.firstName} ${member.lastName}`.trim());
  return ['Toi', ...names].join(', ');
}

function equipmentSummary(values: DiveFormValues): string {
  const { gasMix } = toGasMix(values.gas, num(values.o2Percent));
  const others = join([
    measure(values.tankVolumeL, 'L'),
    measure(values.startPressureBar, 'bar'),
    measure(values.suitThicknessMm, 'mm'),
  ]);
  // Air alone is the untouched default, not something entered.
  if (others === '' && values.gas === 'AIR') return '';
  const o2 = num(values.o2Percent);
  const gas =
    gasMix === 'OTHER'
      ? o2 === null
        ? 'Nitrox'
        : `Nitrox ${formatMeasure(o2)}`
      : gasMixSpoken(gasMix);
  return join([gas, others === '' ? null : others]);
}

function waterSummary(values: DiveFormValues): string | null {
  const surface = num(values.surfaceTemperatureC);
  const bottom = num(values.bottomTemperatureC);
  if (surface !== null && bottom !== null) {
    return `${formatMeasure(surface)} → ${formatMeasure(bottom)} °C`;
  }
  const single = surface ?? bottom;
  return single === null ? null : `${formatMeasure(single)} °C`;
}

function conditionsSummary(values: DiveFormValues): string {
  return join([
    values.entryType === null ? null : ENTRY_TYPE_LABELS[values.entryType],
    values.seaState === null ? null : SEA_STATE_LABELS[values.seaState],
    values.currentStrength === null ? null : CURRENT_STRENGTH_LABELS[values.currentStrength],
    waterSummary(values),
  ]);
}

function notesSummary(values: DiveFormValues): string {
  return join([
    filled(values.notes) ? 'Notes' : null,
    values.species.length > 0 ? formatSpeciesCount(values.species.length) : null,
  ]);
}

function essentialSummary(values: DiveFormValues): string {
  return join([
    filled(values.site.name) ? values.site.name.trim() : null,
    measure(values.maxDepthM, 'm'),
  ]);
}

const SUMMARIES: Record<DiveFormSection, (values: DiveFormValues) => string> = {
  essential: essentialSummary,
  run: runSummary,
  team: teamSummary,
  equipment: equipmentSummary,
  conditions: conditionsSummary,
  notes: notesSummary,
};

/** « Air · 12 L · 200 bar · 7 mm », or « Rien pour l'instant ». */
export function sectionSummary(section: DiveFormSection, values: DiveFormValues): string {
  const summary = SUMMARIES[section](values);
  return summary === '' ? EMPTY_SECTION_SUMMARY : summary;
}

// ── Live preview (right column) ───────────────────────────────────────────────────────────────

export interface DiveFormPreview {
  /** The logbook number the dive will have (`diveNumberFor`). */
  number: number;
  /** « jeu. 09 avr. 2026 », `null` while not a valid day. */
  dateLabel: string | null;
  /** « 10:05 » as typed, `null` while empty. */
  entryTime: string | null;
  siteName: string | null;
  /** « Calvi · Corse » for a site of the log, `null` for a new site. */
  place: string | null;
  /** The four mini-KPI of the detail (profondeur max in accent), `null` when not entered. */
  depthMaxM: number | null;
  durationMin: number | null;
  bottomTemperatureC: number | null;
  visibilityM: number | null;
}

export function divePreview(
  values: DiveFormValues,
  sites: readonly DiveFormSiteOption[],
  number: number,
): DiveFormPreview {
  const site = values.site.id === null ? undefined : sites.find(({ id }) => id === values.site.id);
  return {
    number,
    // The day alone, read in UTC: the label never shifts with the device time zone.
    dateLabel:
      parseDay(values.date) === null ? null : formatDiveLongDate(`${values.date}T12:00:00Z`, 0),
    entryTime: filled(values.entryTime) ? values.entryTime : null,
    siteName: filled(values.site.name) ? values.site.name.trim() : null,
    place: site?.place ?? null,
    depthMaxM: num(values.maxDepthM),
    durationMin: num(values.durationMin),
    bottomTemperatureC: num(values.bottomTemperatureC),
    visibilityM: num(values.visibilityM),
  };
}

/** Section header of the dive team: « 3 plongeurs » (the diver counted). */
export function teamCount(values: Pick<DiveFormValues, 'team'>): number {
  return values.team.length + 1;
}
