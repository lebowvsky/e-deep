// The mocked log as the API serves it (`GET /dives`), for the tests that go through the client.
import type { DiveLogResponse, DiveSummary } from '@e-deep/shared';
import type { LoggedDive } from '../types';
import { mockDives } from './dives';
import { SELF } from './roster';
import { SITES } from './sites';

const SITES_BY_ID = new Map(Object.values(SITES).map((site) => [site.id, site]));

function toDiveSummary(dive: LoggedDive): DiveSummary {
  const site = SITES_BY_ID.get(dive.site.id);
  return {
    id: dive.id,
    number: dive.number,
    date: dive.date,
    utcOffsetMinutes: Number(dive.date.slice(-6, -3)) * 60,
    site: {
      id: dive.site.id,
      name: dive.site.name,
      locality: site?.locality ?? null,
      region: dive.site.regionName,
    },
    depthMaxM: dive.depthMaxM,
    durationMin: dive.durationMin,
    temperatureC: dive.temperatureC,
    gasMix: dive.gasMix,
    notes: dive.notes,
    buddies: dive.team
      .filter((member) => !member.isSelf)
      .map(({ id, firstName, lastName }) => ({ id, firstName, lastName })),
  };
}

/** Latest first, like the API. */
export function toDiveLogResponse(dives: readonly LoggedDive[]): DiveLogResponse {
  return { dives: [...dives].sort((a, b) => b.number - a.number).map(toDiveSummary) };
}

export const mockDiveLogResponse: DiveLogResponse = toDiveLogResponse(mockDives);

/** The owner of the mocked log (`SELF` of the dive teams). */
export const mockOwner = { id: SELF.id, firstName: SELF.firstName, lastName: SELF.lastName };
