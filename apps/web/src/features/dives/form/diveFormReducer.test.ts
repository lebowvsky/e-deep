import { describe, expect, it } from 'vitest';
import { CONTEXT, validValues } from '../mocks/diveFormFixture';
import {
  diveFormReducer,
  initDiveFormState,
  type DiveFormAction,
  type DiveFormState,
} from './diveFormReducer';
import type { DiveFormValues } from './model';
import { validateDiveForm } from './validation';

const context = CONTEXT;

function run(state: DiveFormState, ...actions: DiveFormAction[]): DiveFormState {
  return actions.reduce(diveFormReducer, state);
}

const start = (overrides: Partial<DiveFormValues> = {}) =>
  run(initDiveFormState(validValues(overrides)), { type: 'draftChecked', draft: null });

describe('time link', () => {
  it('recomputes the duration when the exit changes', () => {
    const state = run(start(), { type: 'change', field: 'exitTime', value: '10:50', context });
    expect(state.values.durationMin).toBe('45');
  });

  it('recomputes the exit when the duration changes', () => {
    const state = run(start(), { type: 'change', field: 'durationMin', value: '50', context });
    expect(state.values.exitTime).toBe('10:55');
  });

  it('moves the exit with the immersion, keeping the duration', () => {
    const state = run(start(), { type: 'change', field: 'entryTime', value: '11:00', context });
    expect(state.values).toMatchObject({ exitTime: '11:44', durationMin: '44' });
  });

  it('computes the duration from both times when it is still empty', () => {
    const state = run(start({ entryTime: '', exitTime: '10:49', durationMin: '' }), {
      type: 'change',
      field: 'entryTime',
      value: '10:05',
      context,
    });
    expect(state.values.durationMin).toBe('44');
  });

  it('keeps a typed duration when the moved exit would pass midnight by day', () => {
    const state = run(start({ entryTime: '22:30', exitTime: '23:30', durationMin: '60' }), {
      type: 'change',
      field: 'entryTime',
      value: '23:10',
      context,
    });
    // The diver's measure stays; the validation reports the exit instead.
    expect(state.values).toMatchObject({ durationMin: '60', exitTime: '23:30' });
  });

  it('goes past midnight at night only', () => {
    const late = start({ entryTime: '23:30', exitTime: '23:59', durationMin: '29' });
    const byDay = run(late, { type: 'change', field: 'exitTime', value: '00:15', context });
    expect(byDay.values.durationMin).toBe('29');
    const atNight = run(
      late,
      { type: 'change', field: 'timeOfDay', value: 'NIGHT', context },
      { type: 'change', field: 'exitTime', value: '00:15', context },
    );
    expect(atNight.values.durationMin).toBe('45');
    // Turning Nuit on afterwards links the times that were refused.
    const turnedOn = run(byDay, { type: 'change', field: 'timeOfDay', value: 'NIGHT', context });
    expect(turnedOn.values.durationMin).toBe('45');
  });
});

describe('validation display', () => {
  it('shows nothing while typing, then the error at blur', () => {
    const typed = run(start(), { type: 'change', field: 'weightKg', value: '45', context });
    expect(typed.errors).toEqual({});
    const blurred = run(typed, { type: 'blur', field: 'weightKg', context });
    expect(blurred.errors.weightKg).toBe('Indique un lest entre 0 et 30 kg.');
    expect(blurred.touched.weightKg).toBe(true);
  });

  it('validates live once the field shows an error', () => {
    const state = run(
      start(),
      { type: 'change', field: 'weightKg', value: '45', context },
      { type: 'blur', field: 'weightKg', context },
      { type: 'change', field: 'weightKg', value: '6', context },
    );
    expect(state.errors.weightKg).toBeUndefined();
  });

  it('updates a dependent field already in error', () => {
    const state = run(
      start({ startPressureBar: '200' }),
      { type: 'change', field: 'endPressureBar', value: '210', context },
      { type: 'blur', field: 'endPressureBar', context },
      { type: 'change', field: 'startPressureBar', value: '230', context },
    );
    expect(state.errors.endPressureBar).toBeUndefined();
  });

  it('keeps warnings apart from errors', () => {
    const state = run(
      start(),
      { type: 'change', field: 'maxDepthM', value: '41', context },
      { type: 'blur', field: 'maxDepthM', context },
    );
    expect(state.errors).toEqual({});
    expect(state.warnings.maxDepthM).toBe(
      'Au-delà de 40 m, limite d’un N2 encadré. Vérifie la valeur.',
    );
  });

  it('fills the safety stop defaults when it is turned on', () => {
    const state = run(start(), { type: 'change', field: 'safetyStop', value: true, context });
    expect(state.values).toMatchObject({ safetyStopDurationMin: '3', safetyStopDepthM: '5' });
  });
});

describe('dive team and decompression rows', () => {
  const lucas = { key: 'b1', id: 'b1', firstName: 'Lucas', lastName: 'Bernard', level: '' };

  it('adds a member once, sets a level and removes them', () => {
    let state = run(
      start(),
      { type: 'addMember', member: lucas, context },
      { type: 'addMember', member: { ...lucas, key: 'other' }, context },
      { type: 'setMemberLevel', key: 'b1', level: 'N3', context },
    );
    expect(state.values.team).toEqual([{ ...lucas, level: 'N3' }]);
    state = run(state, { type: 'removeMember', key: 'b1', context });
    expect(state.values.team).toEqual([]);
  });

  it('lets a level change clear a failed save, like any other edit', () => {
    const state = run(
      start(),
      { type: 'addMember', member: lucas, context },
      { type: 'submitFailed' },
      { type: 'setMemberLevel', key: 'b1', level: 'N3', context },
    );
    expect(state.submit).toEqual({ status: 'idle' });
  });

  it('adds, edits and removes decompression rows', () => {
    let state = run(
      start(),
      { type: 'addDecoStop', key: 'k1', context },
      { type: 'changeDecoStop', key: 'k1', part: 'depthM', value: '6', context },
    );
    expect(state.values.decoStops).toEqual([{ key: 'k1', depthM: '6', durationMin: '' }]);
    state = run(state, { type: 'removeDecoStop', key: 'k1', context });
    expect(state.values.decoStops).toEqual([]);
  });
});

describe('modes and draft', () => {
  it('resets to new starting values and clears the messages', () => {
    const state = run(
      start({ weightKg: '45' }),
      { type: 'blur', field: 'weightKg', context },
      { type: 'reset', values: validValues({ notes: 'repartir' }) },
    );
    expect(state.errors).toEqual({});
    expect(state.values.notes).toBe('repartir');
    expect(state.initial).toBe(state.values);
  });

  it('restores a draft over the starting values', () => {
    const draft = { values: validValues({ notes: 'brouillon' }), savedAt: 42 };
    const state = run(initDiveFormState(validValues()), { type: 'draftChecked', draft });
    expect(state.values.notes).toBe('brouillon');
    expect(state.initial.notes).toBe('');
    expect(state.draft).toEqual({ status: 'ready', savedAt: 42, restored: true });
    const discarded = run(state, { type: 'draftDiscarded' });
    expect(discarded.values.notes).toBe('');
    expect(discarded.draft).toEqual({ status: 'ready', savedAt: null, restored: false });
  });

  it('keeps what was typed while the draft was being looked for', () => {
    const draft = { values: validValues({ notes: 'brouillon' }), savedAt: 42 };
    const state = run(
      initDiveFormState(validValues()),
      { type: 'change', field: 'notes', value: 'saisi', context },
      { type: 'draftChecked', draft },
    );
    expect(state.values.notes).toBe('saisi');
    expect(state.draft).toEqual({ status: 'ready', savedAt: null, restored: false });
  });

  it('merges the values of « Reprendre » and stays dirty', () => {
    const state = run(start(), { type: 'merge', values: { diveCenter: 'Calvi Plongée' }, context });
    expect(state.values.diveCenter).toBe('Calvi Plongée');
    expect(state.initial.diveCenter).toBe('');
  });

  it('records when the draft was saved', () => {
    expect(run(start(), { type: 'draftSaved', savedAt: 7 }).draft).toMatchObject({ savedAt: 7 });
    expect(run(initDiveFormState(validValues()), { type: 'draftSaved', savedAt: 7 }).draft).toEqual(
      {
        status: 'checking',
      },
    );
  });
});

describe('submit', () => {
  it('shows every message and lists the fields to fix, in order', () => {
    const values = validValues({ weightKg: '45', site: { id: null, name: '' }, maxDepthM: '45' });
    const state = run(
      start(),
      { type: 'reset', values },
      {
        type: 'submitValidated',
        issues: validateDiveForm(values, context),
      },
    );
    expect(state.submit).toEqual({ status: 'invalid', fields: ['site', 'weightKg'] });
    expect(Object.keys(state.errors)).toEqual(['site', 'weightKg']);
    expect(Object.keys(state.warnings)).toEqual(['maxDepthM']);
  });

  it('goes to submitting without errors, and ignores a second submit meanwhile', () => {
    const issues = { errors: [], warnings: [] };
    const submitting = run(start(), { type: 'submitValidated', issues });
    expect(submitting.submit).toEqual({ status: 'submitting' });
    expect(run(submitting, { type: 'submitValidated', issues })).toBe(submitting);
  });

  it('maps the field errors of the server', () => {
    const state = run(
      start(),
      { type: 'submitValidated', issues: { errors: [], warnings: [] } },
      { type: 'submitRejected', fieldErrors: { site: 'Site inconnu.' } },
    );
    expect(state.errors.site).toBe('Site inconnu.');
    expect(state.submit).toEqual({ status: 'invalid', fields: ['site'] });
  });

  it('keeps the error summary while listed fields are still wrong', () => {
    const values = validValues({ weightKg: '45', tankVolumeL: '99' });
    const invalid = run(
      start(),
      { type: 'reset', values },
      {
        type: 'submitValidated',
        issues: validateDiveForm(values, context),
      },
    );
    expect(invalid.submit).toEqual({ status: 'invalid', fields: ['tankVolumeL', 'weightKg'] });

    const oneFixed = run(invalid, { type: 'change', field: 'weightKg', value: '6', context });
    expect(oneFixed.submit).toEqual({ status: 'invalid', fields: ['tankVolumeL'] });
    const unrelated = run(oneFixed, { type: 'change', field: 'notes', value: 'ok', context });
    expect(unrelated.submit).toEqual({ status: 'invalid', fields: ['tankVolumeL'] });

    const allFixed = run(unrelated, { type: 'change', field: 'tankVolumeL', value: '12', context });
    expect(allFixed.submit).toEqual({ status: 'idle' });
  });

  it('keeps the values on failure, and takes them as saved on success', () => {
    const changed = run(start(), { type: 'change', field: 'notes', value: 'ok', context });
    expect(run(changed, { type: 'submitFailed' }).submit).toEqual({ status: 'failed' });
    const saved = run(changed, { type: 'submitSucceeded', id: 'd128' });
    expect(saved.submit).toEqual({ status: 'saved', id: 'd128' });
    expect(saved.initial).toBe(saved.values);
  });
});
