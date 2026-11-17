// Dive form — values ↔ the input of `saveDive` (and the gas mix in both directions).
import type { GasMix } from '@e-deep/shared';
import { formatNumberInputValue } from '@/shared/lib/format';
import { parseNumberInput } from '@/shared/lib/numberInput';
import type { BuddyContactInput, SaveDiveInput } from '../api/saveDive';
import { AIR_O2_PERCENT, type DiveFormValues, type GasChoice } from './model';
import { deviceUtcOffsetMinutes, toLocalIso } from './timeLink';

/** Nitrox shares with their own mix; any other share is `OTHER` with its percentage (RG-23). */
const NITROX_MIXES: ReadonlyMap<number, GasMix> = new Map([
  [32, 'NITROX32'],
  [36, 'NITROX36'],
]);

/** Air → `AIR`; Nitrox 32 / 36 → `NITROX32` / `NITROX36`; any other share → `OTHER` + share. */
export function toGasMix(
  gas: GasChoice,
  o2Percent: number | null,
): { gasMix: GasMix; o2Percent: number | null } {
  if (gas === 'AIR') return { gasMix: 'AIR', o2Percent: null };
  const mix = o2Percent === null ? undefined : NITROX_MIXES.get(o2Percent);
  return mix === undefined ? { gasMix: 'OTHER', o2Percent } : { gasMix: mix, o2Percent: null };
}

/** The other way round: `OTHER` comes back as Nitrox with its share (empty when not entered). */
export function fromGasMix(
  gasMix: GasMix,
  o2Percent: number | null,
): { gas: GasChoice; o2Percent: string } {
  switch (gasMix) {
    case 'AIR':
      return { gas: 'AIR', o2Percent: '' };
    case 'NITROX32':
      return { gas: 'NITROX', o2Percent: '32' };
    case 'NITROX36':
      return { gas: 'NITROX', o2Percent: '36' };
    case 'OTHER':
      return {
        gas: 'NITROX',
        o2Percent: o2Percent === null ? '' : formatNumberInputValue(o2Percent),
      };
  }
}

/** Oxygen share the form shows: 21 for Air, the typed share for Nitrox. */
export function effectiveO2Percent(values: Pick<DiveFormValues, 'gas' | 'o2Percent'>) {
  return values.gas === 'AIR' ? AIR_O2_PERCENT : parseNumberInput(values.o2Percent);
}

/** What the form writes: a new dive, or the update of an existing one. */
export type DiveFormTarget =
  | { kind: 'create' }
  | {
      kind: 'update';
      diveId: string;
      /** The dive keeps the offset of its place (D-10), whatever the device time zone. */
      utcOffsetMinutes: number;
      /** Counted species of the dive: the form edits labels only, the counts are kept. */
      observationCounts: ReadonlyMap<string, number>;
    };

const text = (value: string): string | null => {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const num = (value: string): number | null => parseNumberInput(value);

/**
 * Validated values → input of `saveDive`. `newId` creates the ids of a new dive and of the site or
 * buddies typed by name (D22). `null` when a required value cannot be read: validate first.
 */
export function toSaveDiveInput(
  values: DiveFormValues,
  target: DiveFormTarget,
  newId: () => string,
): SaveDiveInput | null {
  const maxDepthM = num(values.maxDepthM);
  const durationMin = num(values.durationMin);
  const siteName = text(values.site.name);
  const utcOffsetMinutes =
    target.kind === 'update'
      ? target.utcOffsetMinutes
      : deviceUtcOffsetMinutes(values.date, values.entryTime);
  if (
    maxDepthM === null ||
    durationMin === null ||
    siteName === null ||
    utcOffsetMinutes === null
  ) {
    return null;
  }
  const startedAt = toLocalIso(values.date, values.entryTime, utcOffsetMinutes);
  if (startedAt === null) return null;

  const site = {
    id: values.site.id ?? newId(),
    name: siteName,
    isNew: values.site.id === null,
  };
  const buddies: BuddyContactInput[] = values.team.map((member) => ({
    id: member.id ?? newId(),
    firstName: member.firstName.trim(),
    lastName: member.lastName.trim(),
    levelCode: text(member.level),
    isNew: member.id === null,
  }));
  const gas = toGasMix(values.gas, num(values.o2Percent));
  const counts = target.kind === 'update' ? target.observationCounts : new Map<string, number>();

  return {
    kind: target.kind,
    event: {
      id: target.kind === 'update' ? target.diveId : newId(),
      siteId: site.id,
      startedAt,
      utcOffsetMinutes,
      entryType: values.entryType,
      timeOfDay: values.timeOfDay,
      weather: values.weather,
      airTemperatureC: num(values.airTemperatureC),
      seaState: values.seaState,
      currentStrength: values.currentStrength,
      diveCenter: text(values.diveCenter),
    },
    participation: {
      maxDepthM,
      durationMin,
      waterTemperatureC: num(values.bottomTemperatureC),
      visibilityM: num(values.visibilityM),
      gasMix: gas.gasMix,
      o2Percent: gas.o2Percent,
      hasDecompression: values.decompression,
      stopsOk: values.stopsOk,
      notes: text(values.notes),
      surfaceWaterTemperatureC: num(values.surfaceTemperatureC),
      // Both or none (RG-25): the switch decides.
      safetyStopDurationMin: values.safetyStop ? num(values.safetyStopDurationMin) : null,
      safetyStopDepthM: values.safetyStop ? num(values.safetyStopDepthM) : null,
      isRepetitive: values.repetitive,
      tankVolumeL: num(values.tankVolumeL),
      tankMaterial: values.tankMaterial,
      startPressureBar: num(values.startPressureBar),
      endPressureBar: num(values.endPressureBar),
      suitType: values.suitType,
      suitThicknessMm: num(values.suitThicknessMm),
      weightKg: num(values.weightKg),
    },
    buddyIds: buddies.map(({ id }) => id),
    observations: values.species
      .map((label) => label.trim())
      .filter((label) => label !== '')
      .map((label) => ({ label, count: counts.get(label) ?? null })),
    contacts: { site, buddies },
  };
}
