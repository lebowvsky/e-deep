import { describe, expect, it } from 'vitest';
import { isDashboardResponse, toDashboardState } from './dashboardApi';
import { dashboardResponse } from './dashboardResponse.fixture';

describe('isDashboardResponse', () => {
  it('accepts a body matching the contract', () => {
    expect(isDashboardResponse(dashboardResponse())).toBe(true);
    expect(isDashboardResponse(dashboardResponse({ lastDive: null, sites: [] }))).toBe(true);
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

  it('maps a diver without dive to the empty state', () => {
    const response = dashboardResponse({ lastDive: null, sites: [], frequentBuddies: [] });
    const state = toDashboardState({
      ...response,
      stats: { ...response.stats, totalDives: 0, maxDepthEver: null, mainRegion: null },
    });
    expect(state).toMatchObject({ status: 'empty', user: { firstName: 'Marine' } });
  });
});
