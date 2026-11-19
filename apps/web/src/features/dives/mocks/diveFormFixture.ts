// Dive form values for the unit tests.
import { toDiveDetailView } from '../api/divesApi';
import { mockFilledDiveDetail } from './diveDetailResponse';
import { SELF } from './roster';
import type { DiveDetailView } from '../types';
import { emptyDiveFormValues, type DiveFormValues } from '../form/model';
import type { ValidationContext } from '../form/validation';
import { buildDiveFormSources, type DiveFormSources } from '../form/sources';
import type { Site } from '@/shared/model/site';
import { buildSiteCatalogue } from '@/shared/sites/lib/siteCatalogue';
import { mockSites } from '@/shared/sites/mocks/sites';
import type { LoggedDive } from '../types';
import { toDiveLogResponse } from './diveLogResponse';

/** « L'essentiel » filled with valid values, nothing else. */
export function validValues(overrides: Partial<DiveFormValues> = {}): DiveFormValues {
  return {
    ...emptyDiveFormValues(),
    site: { id: 's01', name: 'Pointe de la Revellata' },
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
};

/** #127 of the mocked log with every detail field of the mockup. */
export function filledDive(): DiveDetailView {
  return toDiveDetailView(mockFilledDiveDetail('d127'), SELF);
}

/**
 * The sources of the form for `log`, with `sites` as the user's sites: by default those of the
 * mocked log that `log` dived (s01 → s23, same ids).
 */
export function formSourcesOf(
  log: readonly LoggedDive[],
  sites: readonly Site[] = mockSites.filter(({ id }) => log.some((dive) => dive.site.id === id)),
): DiveFormSources {
  const { dives } = toDiveLogResponse(log);
  return buildDiveFormSources(log, buildSiteCatalogue({ sites, dives }));
}
