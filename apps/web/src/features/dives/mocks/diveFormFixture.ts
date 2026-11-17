// Dive form values for the unit tests.
import { toDiveDetailView } from '../api/divesApi';
import { mockFilledDiveDetail } from './diveDetailResponse';
import { SELF } from './roster';
import type { DiveDetailView } from '../types';
import { emptyDiveFormValues, type DiveFormValues } from '../form/model';
import type { ValidationContext } from '../form/validation';

/** « L'essentiel » filled with valid values, nothing else. */
export function validValues(overrides: Partial<DiveFormValues> = {}): DiveFormValues {
  return {
    ...emptyDiveFormValues(),
    site: { id: 's01', name: 'Pointe de la Revellata' },
    number: '128',
    date: '2026-04-09',
    entryTime: '10:05',
    exitTime: '10:49',
    durationMin: '44',
    maxDepthM: '18',
    ...overrides,
  };
}

export const CONTEXT: ValidationContext = {
  today: '2026-04-10',
  diverLevel: 'N2',
  takenNumbers: new Set([126, 127]),
};

/** #127 of the mocked log with every detail field of the mockup. */
export function filledDive(): DiveDetailView {
  return toDiveDetailView(mockFilledDiveDetail('d127'), SELF);
}
