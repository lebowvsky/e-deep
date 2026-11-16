// Dive detail — the composite values of the cards, built from what was entered (never guessed).
//
// Each builder returns what a fact line shows, or `null` when nothing of it was entered (the card
// then shows « — · Non renseigné(e) »). A partial value shows what exists: the surface alone, the
// volume alone… Numbers are formatted here, never in the JSX.
import type { GasMix, SuitType, TankMaterial, Weather } from '@e-deep/shared';
import { capitalize, formatMeasure } from '@/shared/lib/format';
import type { DiveConditions, SafetyStop } from '../types';
import {
  ENTRY_TYPE_LABELS,
  gasMixSpoken,
  oxygenLabel,
  SUIT_TYPE_LABELS,
  TANK_MATERIAL_LABELS,
  TIME_OF_DAY_LABELS,
  WEATHER_LABELS,
} from './labels';

/** Plain words (sans): « Bateau · jour ». */
export interface TextFact {
  kind: 'text';
  text: string;
  /** Secondary line (« Air 19 °C »). */
  note?: string;
}

/** A measure (mono, unit in textLow) with its spoken form: « 200 → 60 bar ». */
export interface QuantityFact {
  kind: 'quantity';
  value: string;
  unit?: string;
  /** Value and unit together, as read aloud. */
  srText: string;
  note?: string;
  /** `false` when `srText` already says what the note shows (« surface → fond »). */
  noteSpoken?: boolean;
}

export type FactContent = TextFact | QuantityFact;

const text = (value: string, note?: string): TextFact =>
  note === undefined ? { kind: 'text', text: value } : { kind: 'text', text: value, note };

const degrees = (value: number) => `${formatMeasure(value)} degrés`;

// ── Calculations (front only, never served by the API) ───────────────────────────────────────

/** Bar used: start − end, when both were entered; a negative result (typo) gives nothing. */
export function consumedBar(startBar: number | null, endBar: number | null): number | null {
  if (startBar === null || endBar === null) return null;
  const consumed = startBar - endBar;
  return consumed >= 0 ? consumed : null;
}

/** Share of the dive spent at the safety stop (end segment of the time bar), `null` without one. */
export function stopShare(stop: SafetyStop | null, durationMin: number): number | null {
  if (stop === null || durationMin <= 0) return null;
  return Math.min(1, Math.max(0, stop.durationMin / durationMin));
}

// ── Équipement & gaz ─────────────────────────────────────────────────────────────────────────

/** « Air », note « 21 % O₂ » (none when an `OTHER` share was not entered). */
export function gasFact(gasMix: GasMix, o2Percent: number | null): TextFact {
  return text(gasMixSpoken(gasMix), oxygenLabel(o2Percent) ?? undefined);
}

/** « 12 L · acier » · « 12 L » · « Acier ». */
export function tankFact(
  volumeL: number | null,
  material: TankMaterial | null,
): FactContent | null {
  const materialLabel = material === null ? null : TANK_MATERIAL_LABELS[material];
  if (volumeL === null) return materialLabel === null ? null : text(capitalize(materialLabel));
  const volume = formatMeasure(volumeL);
  return {
    kind: 'quantity',
    value: volume,
    unit: materialLabel === null ? 'L' : `L · ${materialLabel}`,
    srText: materialLabel === null ? `${volume} litres` : `${volume} litres, ${materialLabel}`,
  };
}

/** « 200 → 60 bar », note « 140 bar consommés » · « 200 bar », note « début » · « 60 bar », « fin ». */
export function pressureFact(startBar: number | null, endBar: number | null): QuantityFact | null {
  if (startBar !== null && endBar !== null) {
    const consumed = consumedBar(startBar, endBar);
    const start = formatMeasure(startBar);
    const end = formatMeasure(endBar);
    const fact: QuantityFact = {
      kind: 'quantity',
      value: `${start} → ${end}`,
      unit: 'bar',
      srText: `${start} bars au début, ${end} bars à la fin`,
    };
    return consumed === null ? fact : { ...fact, note: `${formatMeasure(consumed)} bar consommés` };
  }
  const single = startBar ?? endBar;
  if (single === null) return null;
  const value = formatMeasure(single);
  const moment = startBar === null ? 'fin' : 'début';
  return {
    kind: 'quantity',
    value,
    unit: 'bar',
    srText: `${value} bars ${startBar === null ? 'à la fin' : 'au début'}`,
    note: moment,
    noteSpoken: false,
  };
}

/** « 7 mm · semi-étanche » · « 7 mm » · « Semi-étanche ». */
export function suitFact(thicknessMm: number | null, type: SuitType | null): FactContent | null {
  const typeLabel = type === null ? null : SUIT_TYPE_LABELS[type];
  if (thicknessMm === null) return typeLabel === null ? null : text(capitalize(typeLabel));
  const thickness = formatMeasure(thicknessMm);
  const fact: QuantityFact = {
    kind: 'quantity',
    value: `${thickness} mm`,
    srText: `${thickness} millimètres`,
  };
  return typeLabel === null
    ? fact
    : { ...fact, unit: `· ${typeLabel}`, srText: `${fact.srText}, ${typeLabel}` };
}

/** « 4 kg ». */
export function weightFact(weightKg: number | null): QuantityFact | null {
  if (weightKg === null) return null;
  const value = formatMeasure(weightKg);
  return { kind: 'quantity', value, unit: 'kg', srText: `${value} kilos` };
}

// ── Conditions ───────────────────────────────────────────────────────────────────────────────

/** « Bateau · jour » · « Bateau » · « Jour ». */
export function entryFact({ entryType, timeOfDay }: DiveConditions): TextFact | null {
  const entry = entryType === null ? null : ENTRY_TYPE_LABELS[entryType];
  const time = timeOfDay === null ? null : TIME_OF_DAY_LABELS[timeOfDay];
  if (entry !== null) return text(time === null ? entry : `${entry} · ${time}`);
  return time === null ? null : text(capitalize(time));
}

/** « Air 19 °C » */
function airLabel(airTemperatureC: number): string {
  return `Air ${formatMeasure(airTemperatureC)} °C`;
}

/** « Ensoleillé », note « Air 19 °C » · « Ensoleillé » · « Air 19 °C » alone. */
export function weatherFact(
  weather: Weather | null,
  airTemperatureC: number | null,
): TextFact | null {
  const air = airTemperatureC === null ? undefined : airLabel(airTemperatureC);
  if (weather !== null) return text(WEATHER_LABELS[weather], air);
  return air === undefined ? null : text(air);
}

/** « 16 → 14 °C », note « surface → fond » · « 16 °C », « surface » · « 14 °C », « fond ». */
export function waterFact(surfaceC: number | null, bottomC: number | null): QuantityFact | null {
  if (surfaceC !== null && bottomC !== null) {
    return {
      kind: 'quantity',
      value: `${formatMeasure(surfaceC)} → ${formatMeasure(bottomC)}`,
      unit: '°C',
      srText: `${degrees(surfaceC)} en surface, ${degrees(bottomC)} au fond`,
      note: 'surface → fond',
      noteSpoken: false,
    };
  }
  const single = surfaceC ?? bottomC;
  if (single === null) return null;
  const atSurface = surfaceC !== null;
  return {
    kind: 'quantity',
    value: formatMeasure(single),
    unit: '°C',
    srText: `${degrees(single)} ${atSurface ? 'en surface' : 'au fond'}`,
    note: atSurface ? 'surface' : 'fond',
    noteSpoken: false,
  };
}

// ── Déroulé ──────────────────────────────────────────────────────────────────────────────────

/** « 3 min à 5 m » (cell), or `null` when not entered. */
export function safetyStopFact(stop: SafetyStop | null): QuantityFact | null {
  if (stop === null) return null;
  const duration = formatMeasure(stop.durationMin);
  const depth = formatMeasure(stop.depthM);
  return {
    kind: 'quantity',
    value: duration,
    unit: `min à ${depth} m`,
    srText: `${duration} minutes à ${depth} mètres`,
  };
}

/** Caption under the time bar: « palier 3 min à 5 m ». */
export function safetyStopCaption(stop: SafetyStop): string {
  return `palier ${formatMeasure(stop.durationMin)} min à ${formatMeasure(stop.depthM)} m`;
}

/** KPI « Temp. fond » caption: « Surface 16 °C », or `null` when the surface was not entered. */
export function surfaceCaption(surfaceC: number | null): string | null {
  return surfaceC === null ? null : `Surface ${formatMeasure(surfaceC)} °C`;
}
