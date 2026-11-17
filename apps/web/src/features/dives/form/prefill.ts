// Dive form — values of each mode: new, duplicated, edited, and « Reprendre » of the suggestion.
import { formatClockValue, formatNumberInputValue } from '@/shared/lib/format';
import { othersInTeam } from '@/shared/model/dive';
import type { DiveDetailView, LoggedDive } from '../types';
import { fromGasMix, type DiveFormTarget } from './convert';
import { emptyDiveFormValues, type DiveFormValues, type TeamMemberValue } from './model';
import { parseClock, splitLocalIso } from './timeLink';

/** How the form was opened: decides the defaults, the draft key and what saving does. */
export type DiveFormMode =
  { kind: 'new' } | { kind: 'duplicate'; sourceId: string } | { kind: 'edit'; diveId: string };

const SUGGESTION_WINDOW_MS = 48 * 3_600_000;

const numberValue = (value: number | null): string =>
  value === null ? '' : formatNumberInputValue(value);

/** A new dive: everything empty, but the next logbook number and today. */
export function newDiveValues({
  today,
  nextNumber,
}: {
  today: string;
  nextNumber: number;
}): DiveFormValues {
  return { ...emptyDiveFormValues(), number: String(nextNumber), date: today };
}

function toTeamValues(dive: DiveDetailView): TeamMemberValue[] {
  return othersInTeam(dive.team).map((member) => ({
    key: member.id,
    id: member.id,
    firstName: member.firstName,
    lastName: member.lastName,
    level: member.level?.code ?? '',
  }));
}

/** The part a duplicate or « Reprendre » copies: dive team, equipment and conditions. */
export type CarriedValues = Pick<
  DiveFormValues,
  | 'team'
  | 'gas'
  | 'o2Percent'
  | 'tankVolumeL'
  | 'tankMaterial'
  | 'startPressureBar'
  | 'suitThicknessMm'
  | 'suitType'
  | 'weightKg'
  | 'entryType'
  | 'timeOfDay'
  | 'diveCenter'
  | 'weather'
  | 'airTemperatureC'
  | 'seaState'
  | 'currentStrength'
  | 'surfaceTemperatureC'
  | 'bottomTemperatureC'
  | 'visibilityM'
>;

/**
 * Dive team, equipment and conditions of `dive`. Never the times, depth, duration, stops, notes
 * nor species, nor the end pressure (a measure of that dive): the start pressure is the fill.
 */
export function carriedValues(dive: DiveDetailView): CarriedValues {
  const { conditions, equipment } = dive;
  return {
    team: toTeamValues(dive),
    ...fromGasMix(dive.gasMix, dive.gasMix === 'OTHER' ? equipment.o2Percent : null),
    tankVolumeL: numberValue(equipment.tankVolumeL),
    tankMaterial: equipment.tankMaterial,
    startPressureBar: numberValue(equipment.startPressureBar),
    suitThicknessMm: numberValue(equipment.suitThicknessMm),
    suitType: equipment.suitType,
    weightKg: numberValue(equipment.weightKg),
    entryType: conditions.entryType,
    timeOfDay: conditions.timeOfDay,
    diveCenter: conditions.diveCenter ?? '',
    weather: conditions.weather,
    airTemperatureC: numberValue(conditions.airTemperatureC),
    seaState: conditions.seaState,
    currentStrength: conditions.currentStrength,
    surfaceTemperatureC: numberValue(dive.surfaceTemperatureC),
    bottomTemperatureC: numberValue(dive.temperatureC),
    visibilityM: numberValue(dive.visibilityM),
  };
}

/** Duplicate: a new dive (today, next number) with the site and what `carriedValues` copies. */
export function duplicateDiveValues(
  source: DiveDetailView,
  defaults: { today: string; nextNumber: number },
): DiveFormValues {
  return {
    ...newDiveValues(defaults),
    site: { id: source.site.id, name: source.site.name },
    ...carriedValues(source),
  };
}

/** Edit: every value of the dive, the exit computed from the immersion and the duration. */
export function editDiveValues(dive: DiveDetailView): DiveFormValues {
  const { day, clock } = splitLocalIso(dive.date);
  const entry = parseClock(clock);
  const { equipment } = dive;
  return {
    ...emptyDiveFormValues(),
    ...carriedValues(dive),
    site: { id: dive.site.id, name: dive.site.name },
    number: String(dive.number),
    date: day,
    entryTime: clock,
    exitTime: entry === null ? '' : formatClockValue((entry + dive.durationMin) % 1440),
    durationMin: String(dive.durationMin),
    maxDepthM: numberValue(dive.depthMaxM),
    safetyStop: dive.safetyStop !== null,
    safetyStopDurationMin: numberValue(dive.safetyStop?.durationMin ?? null),
    safetyStopDepthM: numberValue(dive.safetyStop?.depthM ?? null),
    stopsOk: dive.stopsOk,
    decompression: dive.hadDecompression,
    repetitive: dive.isRepetitive === true,
    endPressureBar: numberValue(equipment.endPressureBar),
    notes: dive.notes ?? '',
    species: dive.observations.map(({ label }) => label),
  };
}

/** What saving an edited dive needs from it: its id, its offset and the species counts. */
export function editTarget(dive: DiveDetailView): DiveFormTarget {
  return {
    kind: 'update',
    diveId: dive.id,
    utcOffsetMinutes: dive.utcOffsetMinutes,
    observationCounts: new Map(
      dive.observations.flatMap(({ label, count }) =>
        count === null ? [] : [[label, count] as const],
      ),
    ),
  };
}

/**
 * Suggestion of a new dive: the latest dive of the log if it started less than 48 h ago (« Reprendre
 * la palanquée, l'équipement et les conditions de #127 ? »).
 */
export function findResumeSuggestion(log: readonly LoggedDive[], now: Date): LoggedDive | null {
  let latest: LoggedDive | null = null;
  for (const dive of log) {
    if (latest === null || Date.parse(dive.date) > Date.parse(latest.date)) latest = dive;
  }
  if (latest === null) return null;
  const elapsed = now.getTime() - Date.parse(latest.date);
  return elapsed >= 0 && elapsed < SUGGESTION_WINDOW_MS ? latest : null;
}
