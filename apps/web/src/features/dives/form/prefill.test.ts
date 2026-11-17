import { describe, expect, it } from 'vitest';
import { filledDive } from '../mocks/diveFormFixture';
import { makeDive } from '../mocks/diveFixture';
import { emptyDiveFormValues } from './model';
import {
  carriedValues,
  duplicateDiveValues,
  editDiveValues,
  editTarget,
  findResumeSuggestion,
  newDiveValues,
} from './prefill';

const DEFAULTS = { today: '2026-04-10' };

describe('Nouvelle', () => {
  it('leaves everything empty but today', () => {
    expect(newDiveValues(DEFAULTS)).toEqual({
      ...emptyDiveFormValues(),
      date: '2026-04-10',
    });
  });

  it('suggests resuming a dive that started less than 48 h ago', () => {
    const log = [
      makeDive({ number: 126, date: '2026-04-07T10:00:00+02:00' }),
      makeDive({ number: 127, date: '2026-04-08T14:20:00+02:00' }),
    ];
    const before = (hours: number) => new Date(Date.parse(log[1]?.date ?? '') + hours * 3_600_000);
    expect(findResumeSuggestion(log, before(47.9))?.number).toBe(127);
    expect(findResumeSuggestion(log, before(48))).toBeNull();
    expect(findResumeSuggestion(log, before(-1))).toBeNull();
    expect(findResumeSuggestion([], before(1))).toBeNull();
  });
});

describe('Dupliquer', () => {
  const source = filledDive();
  const values = duplicateDiveValues(source, DEFAULTS);

  it('copies the site, dive centre, entry, moment, dive team, equipment and conditions', () => {
    expect(values.site).toEqual({ id: source.site.id, name: source.site.name });
    expect(values.diveCenter).toBe('Calvi Plongée');
    expect(values.entryType).toBe('BOAT');
    expect(values.timeOfDay).toBe('DAY');
    expect(values.team.map(({ id }) => id)).toEqual(
      source.team.filter((member) => !member.isSelf).map(({ id }) => id),
    );
    expect(values).toMatchObject({
      gas: 'AIR',
      tankVolumeL: '12',
      tankMaterial: 'STEEL',
      startPressureBar: '200',
      suitThicknessMm: '7',
      suitType: 'SEMI_DRY',
      weather: 'SUNNY',
      airTemperatureC: '19',
      seaState: 'CALM',
      currentStrength: 'WEAK',
      surfaceTemperatureC: '16',
      bottomTemperatureC: String(source.temperatureC ?? ''),
      visibilityM: '25',
    });
  });

  it('never copies the times, depth, duration, stops nor notes', () => {
    expect(values).toMatchObject({
      date: '2026-04-10',
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
      endPressureBar: '',
      notes: '',
      species: [],
    });
  });
});

describe('Reprendre', () => {
  it('takes the dive team, equipment and conditions only', () => {
    const carried = carriedValues(filledDive());
    expect(Object.keys(carried)).not.toContain('site');
    expect(Object.keys(carried)).not.toContain('maxDepthM');
    expect(Object.keys(carried)).not.toContain('notes');
    expect(carried.diveCenter).toBe('Calvi Plongée');
  });
});

describe('Modifier', () => {
  it('fills every value of the dive, the exit computed from the duration', () => {
    const dive = filledDive();
    const values = editDiveValues(dive);
    expect(values).toMatchObject({
      site: { id: dive.site.id, name: dive.site.name },
      date: dive.date.slice(0, 10),
      entryTime: dive.date.slice(11, 16),
      durationMin: String(dive.durationMin),
      safetyStop: true,
      safetyStopDurationMin: '3',
      safetyStopDepthM: '5',
      stopsOk: true,
      decompression: false,
      repetitive: false,
      endPressureBar: '60',
      species: ['Mérou brun', 'Barracudas', 'Gorgones rouges', 'Corb', 'Murène'],
    });
  });

  it('crosses midnight for the exit of a late dive', () => {
    const dive = { ...filledDive(), date: '2026-04-08T23:40:00+02:00', durationMin: 40 };
    expect(editDiveValues(dive).exitTime).toBe('00:20');
  });

  it('keeps the offset of the dive and its counted species for the save', () => {
    const dive = filledDive();
    const target = editTarget(dive);
    expect(target).toMatchObject({ kind: 'update', diveId: dive.id });
    expect(target.kind === 'update' && target.observationCounts.get('Mérou brun')).toBe(2);
  });
});
