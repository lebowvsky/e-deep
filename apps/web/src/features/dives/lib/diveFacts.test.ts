import { describe, expect, it } from 'vitest';
import type { DiveConditions } from '../types';
import {
  consumedBar,
  entryFact,
  gasFact,
  pressureFact,
  safetyStopCaption,
  safetyStopFact,
  stopShare,
  suitFact,
  surfaceCaption,
  tankFact,
  waterFact,
  weatherFact,
  weightFact,
} from './diveFacts';

const NO_CONDITIONS: DiveConditions = {
  entryType: null,
  timeOfDay: null,
  weather: null,
  airTemperatureC: null,
  seaState: null,
  currentStrength: null,
  diveCenter: null,
};

describe('calculations', () => {
  it('gives the bar used only when both pressures are entered and consistent', () => {
    expect(consumedBar(200, 60)).toBe(140);
    expect(consumedBar(200, 200)).toBe(0);
    expect(consumedBar(200, null)).toBeNull();
    expect(consumedBar(null, 60)).toBeNull();
    expect(consumedBar(60, 200)).toBeNull();
  });

  it('gives the share of the dive spent at the safety stop', () => {
    expect(stopShare({ durationMin: 3, depthM: 5 }, 38)).toBeCloseTo(3 / 38);
    expect(stopShare({ durationMin: 50, depthM: 5 }, 38)).toBe(1);
    expect(stopShare(null, 38)).toBeNull();
    expect(stopShare({ durationMin: 3, depthM: 5 }, 0)).toBeNull();
  });
});

describe('Équipement & gaz', () => {
  it('shows the mix and its oxygen share, no line when unknown', () => {
    expect(gasFact('AIR', 21)).toStrictEqual({ kind: 'text', text: 'Air', note: '21 % O₂' });
    expect(gasFact('OTHER', null)).toStrictEqual({ kind: 'text', text: 'Autre mélange' });
  });

  it('shows the tank with what was entered', () => {
    expect(tankFact(12, 'STEEL')).toStrictEqual({
      kind: 'quantity',
      value: '12',
      unit: 'L · acier',
      srText: '12 litres, acier',
    });
    expect(tankFact(15, null)).toMatchObject({ value: '15', unit: 'L', srText: '15 litres' });
    expect(tankFact(null, 'ALUMINIUM')).toStrictEqual({ kind: 'text', text: 'Alu' });
    expect(tankFact(null, null)).toBeNull();
  });

  it('shows both pressures with the bar used, or the one entered', () => {
    expect(pressureFact(200, 60)).toStrictEqual({
      kind: 'quantity',
      value: '200 → 60',
      unit: 'bar',
      srText: '200 bars au début, 60 bars à la fin',
      note: '140 bar consommés',
    });
    expect(pressureFact(60, 200)).not.toHaveProperty('note');
    expect(pressureFact(200, null)).toMatchObject({ value: '200', note: 'début' });
    expect(pressureFact(null, 60)).toMatchObject({ value: '60', srText: '60 bars à la fin' });
    expect(pressureFact(null, null)).toBeNull();
  });

  it('shows the suit with what was entered', () => {
    expect(suitFact(7, 'SEMI_DRY')).toStrictEqual({
      kind: 'quantity',
      value: '7 mm',
      unit: '· semi-étanche',
      srText: '7 millimètres, semi-étanche',
    });
    expect(suitFact(5, null)).toStrictEqual({
      kind: 'quantity',
      value: '5 mm',
      srText: '5 millimètres',
    });
    expect(suitFact(null, 'DRY')).toStrictEqual({ kind: 'text', text: 'Étanche' });
    expect(suitFact(null, null)).toBeNull();
  });

  it('shows the ballast, decimals in French', () => {
    expect(weightFact(4.5)).toMatchObject({ value: '4,5', unit: 'kg', srText: '4,5 kilos' });
    expect(weightFact(null)).toBeNull();
  });
});

describe('Conditions', () => {
  it('shows the type with what was entered', () => {
    expect(entryFact({ ...NO_CONDITIONS, entryType: 'BOAT', timeOfDay: 'DAY' })).toStrictEqual({
      kind: 'text',
      text: 'Bateau · jour',
    });
    expect(entryFact({ ...NO_CONDITIONS, entryType: 'SHORE' })?.text).toBe('Bord');
    expect(entryFact({ ...NO_CONDITIONS, timeOfDay: 'NIGHT' })?.text).toBe('Nuit');
    expect(entryFact(NO_CONDITIONS)).toBeNull();
  });

  it('shows the weather with the air temperature as a note, or the air alone', () => {
    expect(weatherFact('SUNNY', 19)).toStrictEqual({
      kind: 'text',
      text: 'Ensoleillé',
      note: 'Air 19 °C',
    });
    expect(weatherFact('RAIN', null)).toStrictEqual({ kind: 'text', text: 'Pluie' });
    expect(weatherFact(null, 17.5)).toStrictEqual({ kind: 'text', text: 'Air 17,5 °C' });
    expect(weatherFact(null, null)).toBeNull();
  });

  it('shows the water from the surface to the bottom, or the one entered', () => {
    expect(waterFact(16, 14)).toStrictEqual({
      kind: 'quantity',
      value: '16 → 14',
      unit: '°C',
      srText: '16 degrés en surface, 14 degrés au fond',
      note: 'surface → fond',
      noteSpoken: false,
    });
    expect(waterFact(15.5, null)).toMatchObject({
      value: '15,5',
      note: 'surface',
      srText: '15,5 degrés en surface',
    });
    expect(waterFact(null, 14)).toMatchObject({ value: '14', note: 'fond' });
    expect(waterFact(null, null)).toBeNull();
  });
});

describe('Déroulé and KPI', () => {
  it('shows the safety stop', () => {
    expect(safetyStopFact({ durationMin: 3, depthM: 5 })).toStrictEqual({
      kind: 'quantity',
      value: '3',
      unit: 'min à 5 m',
      srText: '3 minutes à 5 mètres',
    });
    expect(safetyStopFact(null)).toBeNull();
    expect(safetyStopCaption({ durationMin: 3, depthM: 5 })).toBe('palier 3 min à 5 m');
  });

  it('captions the bottom temperature with the surface one when entered', () => {
    expect(surfaceCaption(16)).toBe('Surface 16 °C');
    expect(surfaceCaption(null)).toBeNull();
  });
});
