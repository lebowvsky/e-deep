// Small hand-written dives for the unit tests.
import type { DiveMember } from '@/shared/model/dive';
import type { LoggedDive } from '../types';
import { BUDDIES, SELF } from './roster';

export const lucas: DiveMember = BUDDIES.LB;
export const thao: DiveMember = BUDDIES.TN;
export const elise: DiveMember = BUDDIES.EM;

export function makeDive(overrides: Partial<LoggedDive> & Pick<LoggedDive, 'number'>): LoggedDive {
  return {
    id: `d${overrides.number}`,
    date: '2025-07-14T10:00:00+02:00',
    site: { id: 's01', name: 'Pointe de la Revellata', place: 'Calvi · Corse', region: 'corse' },
    team: [SELF, lucas],
    depthMaxM: 25,
    durationMin: 45,
    temperatureC: 22,
    gasMix: 'AIR',
    notes: null,
    ...overrides,
  };
}
