import { describe, expect, it } from 'vitest';
import { isDashboardResponse } from '@/shared/dashboard/dashboardApi';
import { toDashboardState } from './dashboardApi';
import { dashboardResponse } from './dashboardResponse.fixture';

describe('isDashboardResponse', () => {
  it('accepts a body matching the contract', () => {
    expect(isDashboardResponse(dashboardResponse())).toBe(true);
    expect(isDashboardResponse(dashboardResponse({ lastDive: null, sites: [] }))).toBe(true);
  });

  it('accepts a site without region nor position (created by its name, D-23)', () => {
    const response = dashboardResponse();
    const lastDive = response.lastDive && {
      ...response.lastDive,
      site: { ...response.lastDive.site, region: null },
    };
    expect(
      isDashboardResponse({
        ...response,
        stats: { ...response.stats, mainRegion: null },
        lastDive,
        sites: [
          ...response.sites,
          {
            id: 's3',
            name: 'Le Sec',
            region: null,
            latitude: null,
            longitude: null,
            diveCount: 1,
            maxDepthM: 18,
          },
        ],
      }),
    ).toBe(true);
  });

  it.each([
    ['null', null],
    [
      'an unknown level',
      { ...dashboardResponse(), user: { ...dashboardResponse().user, level: 'MF1' } },
    ],
    [
      'a string count',
      { ...dashboardResponse(), stats: { ...dashboardResponse().stats, totalDives: '38' } },
    ],
    [
      'a malformed month',
      {
        ...dashboardResponse(),
        stats: { ...dashboardResponse().stats, divesPerMonth: [{ month: 'sept', count: 1 }] },
      },
    ],
    [
      'a site without coordinates',
      { ...dashboardResponse(), sites: [{ id: 's1', name: 'X', region: 'Y' }] },
    ],
    [
      'a site with a latitude alone',
      {
        ...dashboardResponse(),
        sites: [{ id: 's1', name: 'X', region: 'Y', latitude: 42, longitude: null }],
      },
    ],
  ])('rejects %s', (_label, body) => {
    expect(isDashboardResponse(body)).toBe(false);
  });
});

describe('toDashboardState', () => {
  it('maps a diver with dives to the ready view model', () => {
    const state = toDashboardState(dashboardResponse());
    if (state.status !== 'ready') throw new Error(`Unexpected ${state.status}`);

    expect(state.data.user).toEqual({
      id: 'u1',
      firstName: 'Marine',
      lastName: 'Rousseau',
      level: 'N2',
      federation: 'FFESSM',
    });
    expect(state.data.stats).toMatchObject({
      maxDepthEver: { depthM: 42, site: 'Pointe de la Revellata' },
      recentMonthDelta: 3,
      mainArea: { name: 'Marseille', mapTitle: 'Marseille' },
    });
    expect(state.data.stats.divesPerMonth.slice(0, 2)).toEqual([
      { month: 'janv', count: 0 },
      { month: 'févr', count: 1 },
    ]);
    expect(state.data.lastDive).toMatchObject({ temperatureC: null, visibilityM: 25 });
    expect(state.data.lastDive).not.toHaveProperty('notes');
    expect(state.data.frequentBuddies).toEqual([
      { id: 'b1', initials: 'LB', firstName: 'Lucas', lastName: 'Bernard', sharedDives: 17 },
    ]);
  });

  it('maps the position of each site, `null` when not entered', () => {
    const response = dashboardResponse();
    const state = toDashboardState({
      ...response,
      sites: [
        ...response.sites,
        {
          id: 's3',
          name: 'Le Sec',
          region: null,
          latitude: null,
          longitude: null,
          diveCount: 1,
          maxDepthM: 18,
        },
      ],
    });
    if (state.status !== 'ready') throw new Error(`Unexpected ${state.status}`);

    expect(state.data.sites.map(({ id, region, position }) => ({ id, region, position }))).toEqual([
      { id: 's1', region: 'Corse', position: { latitude: 42.583, longitude: 8.725 } },
      { id: 's2', region: 'Marseille', position: { latitude: 43.199, longitude: 5.232 } },
      { id: 's3', region: null, position: null },
    ]);
  });

  it('stays ready without a main region when no dived site has one', () => {
    const response = dashboardResponse();
    const state = toDashboardState({ ...response, stats: { ...response.stats, mainRegion: null } });
    if (state.status !== 'ready') throw new Error(`Unexpected ${state.status}`);
    expect(state.data.stats.mainArea).toBeNull();
  });

  it('maps a diver without dive to the empty state', () => {
    const response = dashboardResponse({ lastDive: null, sites: [], frequentBuddies: [] });
    const state = toDashboardState({
      ...response,
      stats: { ...response.stats, totalDives: 0, maxDepthEver: null, mainRegion: null },
    });
    expect(state).toMatchObject({ status: 'empty', user: { firstName: 'Marine' } });
  });
});
