import { describe, expect, it } from 'vitest';
import {
  decompressionLabel,
  gasMixSpoken,
  observationLabel,
  observationSpoken,
  oxygenLabel,
  oxygenPercent,
  placeLabel,
  repetitiveLabel,
} from './labels';

describe('gas labels', () => {
  it('implies the oxygen share of air and nitrox, ignoring an entered one', () => {
    expect(oxygenPercent('AIR', null)).toBe(21);
    expect(oxygenPercent('NITROX32', null)).toBe(32);
    expect(oxygenPercent('NITROX36', 40)).toBe(36);
  });

  it('takes the entered share of another mix, unknown when not entered', () => {
    expect(oxygenPercent('OTHER', 28)).toBe(28);
    expect(oxygenPercent('OTHER', null)).toBeNull();
  });

  it('words the share, nothing when unknown', () => {
    expect(oxygenLabel(21)).toBe('21 % O₂');
    expect(oxygenLabel(null)).toBeNull();
  });

  it('spells the mix out', () => {
    expect(gasMixSpoken('NITROX32')).toBe('Nitrox 32');
  });
});

describe('stop labels', () => {
  it('words the decompression and the repetitive dive', () => {
    expect(decompressionLabel(true)).toBe('Oui');
    expect(decompressionLabel(false)).toBe('Aucun');
    expect(repetitiveLabel(true)).toBe('Oui');
    expect(repetitiveLabel(false)).toBe('Non');
  });
});

describe('detail labels', () => {
  it('joins the parts of a place that were entered, or gives none', () => {
    expect(placeLabel('Calvi · Corse', 'Méditerranée')).toBe('Calvi · Corse · Méditerranée');
    expect(placeLabel('Calvi · Corse', null)).toBe('Calvi · Corse');
    expect(placeLabel('Calvi', null)).toBe('Calvi');
    expect(placeLabel(null, 'Corse')).toBe('Corse');
    expect(placeLabel(null, null)).toBeNull();
  });

  it('shows the count of a species, spoken with its noun', () => {
    expect(observationLabel({ label: 'Mérou brun', count: 2 })).toBe('Mérou brun · 2');
    expect(observationLabel({ label: 'Corb', count: null })).toBe('Corb');
    expect(observationSpoken({ label: 'Mérou brun', count: 2 })).toBe('Mérou brun, 2 individus');
    expect(observationSpoken({ label: 'Murène', count: 1 })).toBe('Murène, 1 individu');
    expect(observationSpoken({ label: 'Corb', count: null })).toBe('Corb');
  });
});
