// Small hand-written dives for the unit tests.
import type { DiveMember } from '@/shared/model/dive';
import type { LoggedDive } from '../types';
import { isoOffsetMinutes } from './generateDives';
import { BUDDIES, SELF } from './roster';

const DEFAULT_DATE = '2025-07-14T10:00:00+02:00';

export const lucas: DiveMember = BUDDIES.LB;
export const thao: DiveMember = BUDDIES.TN;
export const elise: DiveMember = BUDDIES.EM;

/** The offset follows the date (« …+03:00 » → 180) unless the test sets it on purpose. */
export function makeDive(overrides: Partial<LoggedDive> & Pick<LoggedDive, 'number'>): LoggedDive {
  const date = overrides.date ?? DEFAULT_DATE;
  return {
    id: `d${overrides.number}`,
    date,
    utcOffsetMinutes: isoOffsetMinutes(date),
    site: {
      id: 's01',
      name: 'Pointe de la Revellata',
      place: 'Calvi · Corse',
      region: 'corse',
      regionName: 'Corse',
    },
    team: [SELF, lucas],
    depthMaxM: 25,
    durationMin: 45,
    temperatureC: 22,
    gasMix: 'AIR',
    notes: null,
    ...overrides,
  };
}
