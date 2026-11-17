import { describe, expect, it } from 'vitest';
import { validValues } from '../mocks/diveFormFixture';
import {
  consumedBarOf,
  divePreview,
  EMPTY_SECTION_SUMMARY,
  sectionStatus,
  sectionSummary,
  teamCount,
} from './derived';
import { emptyDiveFormValues } from './model';

const lucas = { key: 'b1', id: 'b1', firstName: 'Lucas', lastName: 'Bernard', level: 'N3' };

describe('consumedBarOf', () => {
  it('gives start − end when both are entered and consistent', () => {
    expect(consumedBarOf({ startPressureBar: '200', endPressureBar: '60' })).toBe(140);
    expect(consumedBarOf({ startPressureBar: '200', endPressureBar: '' })).toBeNull();
    expect(consumedBarOf({ startPressureBar: '50', endPressureBar: '60' })).toBeNull();
  });
});

describe('sectionStatus', () => {
  it('says complete, partial with the first missing field, or empty', () => {
    expect(sectionStatus('essential', validValues())).toEqual({ status: 'complete' });
    expect(sectionStatus('essential', validValues({ exitTime: '' }))).toEqual({
      status: 'partial',
      missing: 'Sortie',
    });
    expect(sectionStatus('essential', emptyDiveFormValues())).toEqual({ status: 'empty' });
  });

  it('reads « Équipement & gaz » like the mockup (« − Pression fin »)', () => {
    const values = validValues({
      tankVolumeL: '12',
      tankMaterial: 'STEEL',
      startPressureBar: '200',
      suitThicknessMm: '7',
      suitType: 'SEMI_DRY',
      weightKg: '6',
    });
    expect(sectionStatus('equipment', values)).toEqual({
      status: 'partial',
      missing: 'Pression fin',
    });
    // Air alone is the default, not an entry.
    expect(sectionStatus('equipment', emptyDiveFormValues())).toEqual({ status: 'empty' });
    expect(sectionStatus('equipment', validValues({ gas: 'NITROX' }))).toEqual({
      status: 'partial',
      missing: '% O₂',
    });
  });

  it('treats a switch left off as an answer in « Déroulé »', () => {
    expect(sectionStatus('run', emptyDiveFormValues())).toEqual({ status: 'empty' });
    expect(
      sectionStatus(
        'run',
        validValues({ safetyStop: true, safetyStopDurationMin: '3', safetyStopDepthM: '5' }),
      ),
    ).toEqual({ status: 'complete' });
    expect(sectionStatus('run', validValues({ repetitive: true }))).toEqual({ status: 'empty' });
    expect(
      sectionStatus(
        'run',
        validValues({
          safetyStop: true,
          safetyStopDurationMin: '3',
          safetyStopDepthM: '5',
          repetitive: true,
        }),
      ),
    ).toEqual({ status: 'partial', missing: 'Intervalle de surface' });
  });

  it('counts the dive team complete with one buddy', () => {
    expect(sectionStatus('team', validValues())).toEqual({ status: 'empty' });
    expect(sectionStatus('team', validValues({ team: [lucas] }))).toEqual({ status: 'complete' });
  });
});

describe('sectionSummary', () => {
  it('summarises a folded section like the mockup', () => {
    const values = validValues({
      safetyStop: true,
      safetyStopDurationMin: '3',
      safetyStopDepthM: '5',
      team: [lucas, { ...lucas, key: 'b2', id: 'b2', firstName: 'Thao', lastName: 'Nguyen' }],
      tankVolumeL: '12',
      startPressureBar: '200',
      suitThicknessMm: '7',
      entryType: 'BOAT',
      seaState: 'SLIGHT',
      currentStrength: 'WEAK',
      surfaceTemperatureC: '16',
      bottomTemperatureC: '14',
    });
    expect(sectionSummary('run', values)).toBe('Palier de sécurité 3 min à 5 m');
    expect(sectionSummary('team', values)).toBe('Toi, Lucas Bernard, Thao Nguyen');
    expect(sectionSummary('equipment', values)).toBe('Air · 12 L · 200 bar · 7 mm');
    expect(sectionSummary('conditions', values)).toBe('Bateau · Peu agitée · Faible · 16 → 14 °C');
    expect(sectionSummary('notes', values)).toBe(EMPTY_SECTION_SUMMARY);
    expect(
      sectionSummary('notes', validValues({ notes: 'Belle plongée', species: ['Corb'] })),
    ).toBe('Notes · 1 espèce');
    expect(sectionSummary('equipment', validValues({ gas: 'NITROX', o2Percent: '32' }))).toBe(
      'Nitrox 32',
    );
  });

  it('says « Rien pour l’instant » for an untouched section', () => {
    expect(sectionSummary('equipment', emptyDiveFormValues())).toBe('Rien pour l’instant');
  });
});

describe('divePreview', () => {
  it('shows the number, day, time, site, place and the four mini-KPI', () => {
    const preview = divePreview(
      validValues({ bottomTemperatureC: '14' }),
      [{ id: 's01', name: 'Pointe de la Revellata', place: 'Calvi · Corse', diveCount: 12 }],
      128,
    );
    expect(preview).toEqual({
      number: 128,
      dateLabel: 'jeu. 09 avr. 2026',
      entryTime: '10:05',
      siteName: 'Pointe de la Revellata',
      place: 'Calvi · Corse',
      depthMaxM: 18,
      durationMin: 44,
      bottomTemperatureC: 14,
      visibilityM: null,
    });
  });

  it('leaves out what is not entered yet', () => {
    const preview = divePreview(emptyDiveFormValues(), [], 1);
    expect(preview.dateLabel).toBeNull();
    expect(preview.siteName).toBeNull();
    expect(preview.place).toBeNull();
  });

  it('counts the diver in the dive team', () => {
    expect(teamCount(validValues({ team: [lucas] }))).toBe(2);
  });
});
