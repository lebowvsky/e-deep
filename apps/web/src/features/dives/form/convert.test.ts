import { describe, expect, it } from 'vitest';
import { toDiveDetailView } from '../api/divesApi';
import { buildDiveDetail } from '../api/inMemoryDiveRepository';
import { filledDive, validValues } from '../mocks/diveFormFixture';
import { SELF } from '../mocks/roster';
import { effectiveO2Percent, fromGasMix, toGasMix, toSaveDiveInput } from './convert';
import type { DiveFormValues } from './model';
import { editDiveValues, editTarget } from './prefill';

function idSequence() {
  let next = 0;
  return () => `new-${++next}`;
}

describe('gas', () => {
  it('maps Air and Nitrox to the mixes of the model (RG-23)', () => {
    expect(toGasMix('AIR', 32)).toEqual({ gasMix: 'AIR', o2Percent: null });
    expect(toGasMix('NITROX', 32)).toEqual({ gasMix: 'NITROX32', o2Percent: null });
    expect(toGasMix('NITROX', 36)).toEqual({ gasMix: 'NITROX36', o2Percent: null });
    expect(toGasMix('NITROX', 28)).toEqual({ gasMix: 'OTHER', o2Percent: 28 });
    expect(toGasMix('NITROX', 32.5)).toEqual({ gasMix: 'OTHER', o2Percent: 32.5 });
  });

  it('maps them back', () => {
    expect(fromGasMix('AIR', null)).toEqual({ gas: 'AIR', o2Percent: '' });
    expect(fromGasMix('NITROX32', null)).toEqual({ gas: 'NITROX', o2Percent: '32' });
    expect(fromGasMix('NITROX36', null)).toEqual({ gas: 'NITROX', o2Percent: '36' });
    expect(fromGasMix('OTHER', 28.5)).toEqual({ gas: 'NITROX', o2Percent: '28,5' });
    expect(fromGasMix('OTHER', null)).toEqual({ gas: 'NITROX', o2Percent: '' });
  });

  it('shows 21 % for Air', () => {
    expect(effectiveO2Percent({ gas: 'AIR', o2Percent: '' })).toBe(21);
    expect(effectiveO2Percent({ gas: 'NITROX', o2Percent: '32' })).toBe(32);
  });
});

describe('toSaveDiveInput', () => {
  it('writes every field, null when not entered (D-22), with new ids', () => {
    const input = toSaveDiveInput(
      validValues({
        site: { id: null, name: ' Le Sec ' },
        team: [{ key: 'k', id: null, firstName: 'Lucas', lastName: 'Bernard', level: 'N3' }],
        surfaceTemperatureC: '-1,5',
      }),
      { kind: 'create' },
      idSequence(),
    );
    expect(input?.kind).toBe('create');
    expect(input?.contacts.site).toEqual({ id: 'new-1', name: 'Le Sec', isNew: true });
    expect(input?.contacts.buddies).toEqual([
      { id: 'new-2', firstName: 'Lucas', lastName: 'Bernard', levelCode: 'N3', isNew: true },
    ]);
    expect(input?.buddyIds).toEqual(['new-2']);
    expect(input?.event).toMatchObject({ id: 'new-3', siteId: 'new-1', diveCenter: null });
    expect(input?.event.startedAt.startsWith('2026-04-09T10:05:00')).toBe(true);
    expect(input?.participation).toMatchObject({
      maxDepthM: 18,
      durationMin: 44,
      surfaceWaterTemperatureC: -1.5,
      safetyStopDurationMin: null,
      safetyStopDepthM: null,
      gasMix: 'AIR',
      o2Percent: null,
      notes: null,
    });
  });

  it('writes the safety stop only when the switch is on (RG-25)', () => {
    const stop = { safetyStopDurationMin: '3', safetyStopDepthM: '5' };
    const off = toSaveDiveInput(validValues(stop), { kind: 'create' }, idSequence());
    const on = toSaveDiveInput(
      validValues({ ...stop, safetyStop: true }),
      { kind: 'create' },
      idSequence(),
    );
    expect(off?.participation.safetyStopDurationMin).toBeNull();
    expect(on?.participation).toMatchObject({ safetyStopDurationMin: 3, safetyStopDepthM: 5 });
  });

  it('gives nothing for values that validation would refuse', () => {
    expect(
      toSaveDiveInput(validValues({ maxDepthM: '' }), { kind: 'create' }, idSequence()),
    ).toBeNull();
  });
});

describe('round trip form → DiveDetail → form', () => {
  /** Saves `values` as the edit of `dive`, then reopens the result in the form. */
  function roundTrip(values: DiveFormValues): DiveFormValues {
    const dive = filledDive();
    const input = toSaveDiveInput(values, editTarget(dive), idSequence());
    if (input === null) throw new Error('Invalid values');
    const detail = buildDiveDetail(input, {
      site: { ...dive.site, locality: null, region: dive.site.regionName },
      diverLevel: { agency: 'FFESSM', code: 'N2', label: 'Niveau 2' },
      createdAt: dive.createdAt,
      updatedAt: dive.updatedAt,
    });
    return editDiveValues(toDiveDetailView({ ...detail, number: dive.number }, SELF));
  }

  it('gives back the values of the edited dive', () => {
    const values = editDiveValues(filledDive());
    expect(roundTrip(values)).toEqual(values);
  });

  it('gives back every gas', () => {
    for (const o2Percent of ['32', '36', '28,5']) {
      const values = { ...editDiveValues(filledDive()), gas: 'NITROX' as const, o2Percent };
      expect(roundTrip(values)).toMatchObject({ gas: 'NITROX', o2Percent });
    }
  });

  it('keeps the count of a species still listed', () => {
    const dive = filledDive();
    const input = toSaveDiveInput(editDiveValues(dive), editTarget(dive), idSequence());
    expect(input?.observations[0]).toEqual({ label: 'Mérou brun', count: 2 });
  });
});
