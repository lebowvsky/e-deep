import { describe, expect, it } from 'vitest';
import { CONTEXT, validValues } from '../mocks/diveFormFixture';
import type { DiveFormField, DiveFormValues } from './model';
import { validateDiveForm, validateField, type ValidationContext } from './validation';

function issue(
  field: DiveFormField,
  overrides: Partial<DiveFormValues>,
  context: ValidationContext = CONTEXT,
) {
  return validateField(field, validValues(overrides), context);
}

const errorOf = (field: DiveFormField, overrides: Partial<DiveFormValues>) => {
  const result = issue(field, overrides);
  return result?.level === 'error' ? result.message : null;
};
const warningOf = (field: DiveFormField, overrides: Partial<DiveFormValues>, context = CONTEXT) => {
  const result = issue(field, overrides, context);
  return result?.level === 'warning' ? result.message : null;
};

/** Accepts every `valid` raw value and refuses every `invalid` one. */
function checkBounds(
  field: DiveFormField,
  { valid, invalid }: { valid: string[]; invalid: string[] },
  extra: Partial<DiveFormValues> = {},
) {
  for (const value of valid) expect(errorOf(field, { ...extra, [field]: value }), value).toBeNull();
  for (const value of invalid) {
    expect(errorOf(field, { ...extra, [field]: value }), value).not.toBeNull();
  }
}

describe('L’essentiel', () => {
  it('requires a site, with a message that says what to do', () => {
    expect(errorOf('site', { site: { id: null, name: '  ' } })).toBe(
      'Choisis un site ou crée-en un nouveau pour enregistrer la plongée.',
    );
    expect(errorOf('site', { site: { id: null, name: 'Nouveau site' } })).toBeNull();
    expect(errorOf('site', { site: { id: null, name: 'x'.repeat(101) } })).not.toBeNull();
  });

  it('requires a date, not in the future', () => {
    expect(errorOf('date', { date: '' })).toBe('Indique la date de la plongée.');
    expect(errorOf('date', { date: '2026-04-10' })).toBeNull();
    expect(errorOf('date', { date: '2026-04-11' })).toBe(
      'La date est dans le futur : indique le jour de la plongée.',
    );
    expect(errorOf('date', { date: '2026-02-30' })).not.toBeNull();
  });

  it('requires the immersion and the exit times', () => {
    expect(errorOf('entryTime', { entryTime: '' })).toBe('Indique l’heure d’immersion.');
    expect(errorOf('exitTime', { exitTime: '' })).toBe('Indique l’heure de sortie.');
  });

  it('wants the exit after the immersion, unless the dive is at night', () => {
    expect(errorOf('exitTime', { exitTime: '09:49' })).toBe(
      'La sortie doit être après l’immersion (10:05). Après minuit, choisis le moment Nuit.',
    );
    expect(errorOf('exitTime', { exitTime: '10:05' })).toBe(
      'La sortie doit être après l’immersion (10:05).',
    );
    expect(
      errorOf('exitTime', { entryTime: '23:30', exitTime: '00:15', timeOfDay: 'NIGHT' }),
    ).toBeNull();
    expect(errorOf('exitTime', { entryTime: '23:30', exitTime: '00:15' })).not.toBeNull();
  });

  it('keeps the duration between 1 and 300 min, whole, and consistent with the times', () => {
    const times = { entryTime: '', exitTime: '' };
    checkBounds('durationMin', { valid: ['1', '300'], invalid: ['', '0', '301', '12,5'] }, times);
    expect(errorOf('durationMin', { durationMin: '50' })).toBe(
      'La durée ne correspond pas aux heures (44 min). Corrige la durée ou la sortie.',
    );
  });

  it('requires a depth between 1 and 100 m', () => {
    expect(errorOf('maxDepthM', { maxDepthM: '' })).toBe(
      'Indique la profondeur max, entre 1 et 100 m.',
    );
    checkBounds('maxDepthM', { valid: ['1', '17,5', '100'], invalid: ['0,5', '100,1', 'abc'] });
  });

  it('warns, without blocking, beyond the limit of the diver’s level', () => {
    expect(warningOf('maxDepthM', { maxDepthM: '41' })).toBe(
      'Au-delà de 40 m, limite d’un N2 encadré. Vérifie la valeur.',
    );
    expect(warningOf('maxDepthM', { maxDepthM: '40' })).toBeNull();
    const at = (diverLevel: string | null) => ({ ...CONTEXT, diverLevel });
    expect(warningOf('maxDepthM', { maxDepthM: '21' }, at('N1'))).toBe(
      'Au-delà de 20 m, limite d’un N1 encadré. Vérifie la valeur.',
    );
    expect(warningOf('maxDepthM', { maxDepthM: '61' }, at('N3'))).toBe(
      'Au-delà de 60 m, limite d’un N3. Vérifie la valeur.',
    );
    expect(warningOf('maxDepthM', { maxDepthM: '60' }, at('N4'))).toBeNull();
    expect(warningOf('maxDepthM', { maxDepthM: '80' }, at(null))).toBeNull();
  });

  it('warns when the number is already in the log, and refuses a non-number', () => {
    expect(warningOf('number', { number: '127' })).toBe(
      'Le n° 127 existe déjà dans ton carnet. Vérifie le numéro.',
    );
    expect(issue('number', { number: '128' })).toBeNull();
    expect(issue('number', { number: '' })).toBeNull();
    expect(errorOf('number', { number: '0' })).not.toBeNull();
    expect(errorOf('number', { number: '12,5' })).not.toBeNull();
  });
});

describe('Déroulé', () => {
  const on = { safetyStop: true, safetyStopDurationMin: '3', safetyStopDepthM: '5' };

  it('checks the safety stop only when it is on', () => {
    expect(errorOf('safetyStopDurationMin', { safetyStopDurationMin: '99' })).toBeNull();
    checkBounds('safetyStopDurationMin', { valid: ['1', '15'], invalid: ['', '0', '16'] }, on);
    checkBounds('safetyStopDepthM', { valid: ['3', '6'], invalid: ['', '2,9', '6,5'] }, on);
  });

  it('keeps the stop shorter than the dive and no deeper than it (RG-25)', () => {
    expect(errorOf('safetyStopDepthM', { ...on, maxDepthM: '4' })).toBe(
      'Le palier ne peut pas être plus profond que la plongée (4 m).',
    );
    expect(
      errorOf('safetyStopDurationMin', {
        ...on,
        safetyStopDurationMin: '10',
        durationMin: '10',
        exitTime: '10:15',
      }),
    ).toBe('Le palier doit durer moins que la plongée (10 min).');
  });

  it('wants every decompression stop complete', () => {
    const stop = { key: 'k1', depthM: '6', durationMin: '' };
    expect(errorOf('decoStops', { decompression: true, decoStops: [stop] })).not.toBeNull();
    expect(
      errorOf('decoStops', { decompression: true, decoStops: [{ ...stop, durationMin: '2' }] }),
    ).toBeNull();
    expect(errorOf('decoStops', { decompression: false, decoStops: [stop] })).toBeNull();
  });

  it('reads the surface interval as h:mm', () => {
    expect(errorOf('surfaceInterval', { repetitive: true, surfaceInterval: '1:30' })).toBeNull();
    expect(errorOf('surfaceInterval', { repetitive: true, surfaceInterval: '' })).toBeNull();
    expect(errorOf('surfaceInterval', { repetitive: true, surfaceInterval: '90' })).not.toBeNull();
  });
});

describe('Palanquée', () => {
  it('wants a first and a last name for each diver', () => {
    const member = { key: 'k', id: null, firstName: 'Lucas', lastName: '', level: '' };
    expect(errorOf('team', { team: [member] })).toBe(
      'Indique le prénom et le nom de chaque plongeur de la palanquée.',
    );
    expect(errorOf('team', { team: [{ ...member, lastName: 'Bernard' }] })).toBeNull();
  });
});

describe('Équipement & gaz', () => {
  it('asks for an O₂ share between 22 and 40 with Nitrox only', () => {
    checkBounds(
      'o2Percent',
      { valid: ['22', '32', '40'], invalid: ['', '21', '40,5'] },
      {
        gas: 'NITROX',
      },
    );
    expect(errorOf('o2Percent', { gas: 'AIR', o2Percent: '' })).toBeNull();
  });

  it('bounds the tank, the pressures and the ballast', () => {
    checkBounds('tankVolumeL', { valid: ['', '1', '30'], invalid: ['0', '30,5'] });
    checkBounds('startPressureBar', { valid: ['', '1', '300'], invalid: ['0', '301', '200,5'] });
    checkBounds('weightKg', { valid: ['', '0', '30'], invalid: ['30,5'] });
    checkBounds('suitThicknessMm', { valid: ['', '0', '15'], invalid: ['16'] });
  });

  it('wants the end pressure below the start one', () => {
    expect(errorOf('endPressureBar', { startPressureBar: '200', endPressureBar: '200' })).toBe(
      'La pression de fin doit être inférieure à la pression de début (200 bar).',
    );
    expect(
      errorOf('endPressureBar', { startPressureBar: '200', endPressureBar: '199' }),
    ).toBeNull();
    expect(errorOf('endPressureBar', { endPressureBar: '0' })).toBeNull();
  });
});

describe('Conditions', () => {
  it('bounds the water between −2 and 35 °C', () => {
    checkBounds('surfaceTemperatureC', { valid: ['-2', '0', '35'], invalid: ['-2,5', '35,5'] });
    checkBounds('bottomTemperatureC', { valid: ['-2', '35'], invalid: ['-3', '36'] });
  });

  it('allows the bottom 5 °C warmer than the surface at most', () => {
    const surface = { surfaceTemperatureC: '16' };
    expect(errorOf('bottomTemperatureC', { ...surface, bottomTemperatureC: '21' })).toBeNull();
    expect(errorOf('bottomTemperatureC', { ...surface, bottomTemperatureC: '21,5' })).toBe(
      'L’eau au fond ne peut pas dépasser la surface de plus de 5 °C. Vérifie les deux valeurs.',
    );
  });

  it('bounds the air, the visibility and the dive centre (H-10, H-17)', () => {
    checkBounds('airTemperatureC', { valid: ['-40', '60'], invalid: ['-41', '61'] });
    checkBounds('visibilityM', { valid: ['0', '100'], invalid: ['101'] });
    checkBounds('diveCenter', { valid: ['x'.repeat(120)], invalid: ['x'.repeat(121)] });
  });
});

describe('Notes & observations', () => {
  it('bounds the notes and the species (H-10, RG-27)', () => {
    checkBounds('notes', { valid: ['x'.repeat(5000)], invalid: ['x'.repeat(5001)] });
    expect(errorOf('species', { species: ['Corb', 'corb '] })).toBe(
      'Retire les espèces en double.',
    );
    expect(errorOf('species', { species: Array.from({ length: 51 }, (_, i) => `e${i}`) })).toBe(
      'Garde 50 espèces au plus.',
    );
    expect(errorOf('species', { species: ['x'.repeat(81)] })).not.toBeNull();
  });
});

describe('validateDiveForm', () => {
  it('passes valid values, whatever the warnings', () => {
    const { errors, warnings } = validateDiveForm(
      validValues({ maxDepthM: '45', number: '127' }),
      CONTEXT,
    );
    expect(errors).toEqual([]);
    expect(warnings.map(({ field }) => field)).toEqual(['number', 'maxDepthM']);
  });

  it('gives the errors apart from the warnings, in the order of the form', () => {
    const { errors, warnings } = validateDiveForm(
      validValues({
        weightKg: '40',
        site: { id: null, name: '' },
        exitTime: '09:00',
        number: '127',
      }),
      CONTEXT,
    );
    expect(errors.map(({ field }) => field)).toEqual(['site', 'exitTime', 'weightKg']);
    expect(errors.every(({ level }) => level === 'error')).toBe(true);
    expect(warnings.map(({ field }) => field)).toEqual(['number']);
  });
});
