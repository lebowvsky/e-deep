import { describe, expect, it } from 'vitest';
import { DIVE_FORM_FIELDS } from '../form/model';
import { ONE_DECIMAL_MESSAGE } from '../form/validation';
import { toDiveFormFieldErrors } from './fieldErrorMapping';

const fieldOf = (path: string, codes: string[] = ['min']) =>
  Object.keys(toDiveFormFieldErrors({ [path]: codes }) ?? {});

describe('toDiveFormFieldErrors', () => {
  it.each([
    ['site', 'site'],
    ['site.name', 'site'],
    ['site.id', 'site'],
    ['event.siteId', 'site'],
    ['event.startedAt', 'date'],
    ['event.utcOffsetMinutes', 'date'],
    ['event.entryType', 'entryType'],
    ['event.timeOfDay', 'timeOfDay'],
    ['event.weather', 'weather'],
    ['event.airTemperatureC', 'airTemperatureC'],
    ['event.seaState', 'seaState'],
    ['event.currentStrength', 'currentStrength'],
    ['event.diveCenter', 'diveCenter'],
    ['participation.maxDepthM', 'maxDepthM'],
    ['participation.durationMin', 'durationMin'],
    ['participation.waterTemperatureC', 'bottomTemperatureC'],
    ['participation.surfaceWaterTemperatureC', 'surfaceTemperatureC'],
    ['participation.visibilityM', 'visibilityM'],
    ['participation.gasMix', 'gas'],
    ['participation.o2Percent', 'o2Percent'],
    ['participation.hasDecompression', 'decompression'],
    ['participation.stopsOk', 'stopsOk'],
    ['participation.isRepetitive', 'repetitive'],
    ['participation.notes', 'notes'],
    ['participation.safetyStopDurationMin', 'safetyStopDurationMin'],
    ['participation.safetyStopDepthM', 'safetyStopDepthM'],
    ['participation.tankVolumeL', 'tankVolumeL'],
    ['participation.tankMaterial', 'tankMaterial'],
    ['participation.startPressureBar', 'startPressureBar'],
    ['participation.endPressureBar', 'endPressureBar'],
    ['participation.suitType', 'suitType'],
    ['participation.suitThicknessMm', 'suitThicknessMm'],
    ['participation.weightKg', 'weightKg'],
    ['observations', 'species'],
    ['observations.3.label', 'species'],
    ['observations.0.count', 'species'],
    ['buddies', 'team'],
    ['buddies.0.lastName', 'team'],
    ['buddies.2.levelCode', 'team'],
  ])('maps %s to the %s field', (path, field) => {
    expect(fieldOf(path)).toEqual([field]);
  });

  it('only maps to fields of the form', () => {
    const fields: readonly string[] = DIVE_FORM_FIELDS;
    const paths = ['site.name', 'event.startedAt', 'participation.gasMix', 'buddies.0.id'];
    for (const path of paths) expect(fields).toContain(fieldOf(path)[0]);
  });

  it('gives the message of the rule a code names, else the field’s', () => {
    expect(
      toDiveFormFieldErrors({ 'participation.endPressureBar': ['above-start-pressure'] }),
    ).toEqual({
      endPressureBar: 'La pression de fin doit être inférieure à la pression de début.',
    });
    expect(toDiveFormFieldErrors({ 'participation.safetyStopDepthM': ['pair'] })).toEqual({
      safetyStopDepthM: 'Indique la durée et la profondeur du palier, ou désactive le palier.',
    });
    expect(toDiveFormFieldErrors({ 'participation.o2Percent': ['o2-other-only'] })).toEqual({
      o2Percent: 'Le % d’O₂ ne s’indique que pour le Nitrox.',
    });
    expect(toDiveFormFieldErrors({ observations: ['too-many'] })).toEqual({
      species: 'Garde 50 espèces au plus.',
    });
    expect(toDiveFormFieldErrors({ 'buddies.1.firstName': ['required'] })).toEqual({
      team: 'Indique le prénom et le nom de chaque plongeur de la palanquée.',
    });
    expect(toDiveFormFieldErrors({ 'participation.o2Percent': ['max'] })).toEqual({
      o2Percent: 'Indique un % d’O₂ entre 22 et 40 pour le Nitrox.',
    });
  });

  it('keeps the paths that are form fields, and gives `null` when none is', () => {
    expect(
      toDiveFormFieldErrors({ 'event.id': ['matches-route'], 'participation.weightKg': ['max'] }),
    ).toEqual({ weightKg: 'Indique un lest entre 0 et 30 kg.' });
    expect(
      toDiveFormFieldErrors({ 'event.id': ['uuid'], baseUpdatedAt: ['date-time'] }),
    ).toBeNull();
    expect(toDiveFormFieldErrors({})).toBeNull();
  });

  it('names the rule of the codes the form checks too', () => {
    for (const path of [
      'participation.maxDepthM',
      'participation.tankVolumeL',
      'participation.suitThicknessMm',
      'participation.weightKg',
      'participation.o2Percent',
      'participation.safetyStopDepthM',
      'participation.waterTemperatureC',
      'participation.surfaceWaterTemperatureC',
      'event.airTemperatureC',
    ]) {
      expect(Object.values(toDiveFormFieldErrors({ [path]: ['precision'] }) ?? {}), path).toEqual([
        ONE_DECIMAL_MESSAGE,
      ]);
    }
    expect(toDiveFormFieldErrors({ 'participation.visibilityM': ['integer'] })).toEqual({
      visibilityM: 'Indique une visibilité en mètres entiers, entre 0 et 100 m.',
    });
    expect(toDiveFormFieldErrors({ 'participation.safetyStopDurationMin': ['integer'] })).toEqual({
      safetyStopDurationMin:
        'Indique une durée de palier en minutes entières, entre 1 et 15 min, ou désactive le palier.',
    });
    expect(toDiveFormFieldErrors({ 'participation.startPressureBar': ['integer'] })).toEqual({
      startPressureBar: 'Indique une pression de début en bar entiers, entre 1 et 300 bar.',
    });
    expect(toDiveFormFieldErrors({ 'participation.suitThicknessMm': ['min'] })).toEqual({
      suitThicknessMm: 'Indique une épaisseur entre 0,5 et 15 mm.',
    });
  });

  it('says what to check when the date and the offset disagree', () => {
    const message =
      'L’heure d’immersion ne correspond pas au fuseau de l’appareil. Vérifie la date et l’heure, puis réessaie.';
    expect(toDiveFormFieldErrors({ 'event.startedAt': ['matches-offset'] })).toEqual({
      date: message,
    });
    expect(toDiveFormFieldErrors({ 'event.utcOffsetMinutes': ['matches-offset'] })).toEqual({
      date: message,
    });
  });

  it('caps the dive team like the form', () => {
    expect(toDiveFormFieldErrors({ buddies: ['too-many'] })).toEqual({
      team: 'Retire des plongeurs : la palanquée compte 50 plongeurs au plus, toi compris.',
    });
  });
});
