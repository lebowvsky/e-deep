import type { DashboardResponse } from '@e-deep/shared';

/** A valid `GET /dashboard` body, for the tests. */
export function dashboardResponse(overrides: Partial<DashboardResponse> = {}): DashboardResponse {
  const lucas = { id: 'b1', firstName: 'Lucas', lastName: 'Bernard', sharedDives: 17 };
  return {
    user: {
      id: 'u1',
      firstName: 'Marine',
      lastName: 'Rousseau',
      level: 'N2',
      federation: 'FFESSM',
      avatarUrl: null,
    },
    stats: {
      totalDives: 38,
      totalUnderwaterMinutes: 1871,
      maxDepthEver: {
        depthM: 42,
        siteName: 'Pointe de la Revellata',
        date: '2026-11-07T16:00:00+01:00',
      },
      sitesVisited: 2,
      divesPerMonth: Array.from({ length: 12 }, (_unused, index) => ({
        month: `2026-${String(index + 1).padStart(2, '0')}`,
        count: index % 4,
      })),
      divesThisMonth: 3,
      mainRegion: 'Marseille',
    },
    lastDive: {
      id: 'p1',
      date: '2026-11-07T16:00:00+01:00',
      utcOffsetMinutes: 60,
      site: { id: 's1', name: 'Pointe de la Revellata', region: 'Corse' },
      depthMaxM: 42,
      durationMin: 38,
      temperatureC: null,
      visibilityM: 25,
      gasMix: 'AIR',
      hadDecompression: false,
      stopsOk: true,
      notes: null,
      buddies: [lucas],
    },
    sites: [
      {
        id: 's1',
        name: 'Pointe de la Revellata',
        region: 'Corse',
        latitude: 42.583,
        longitude: 8.725,
        diveCount: 3,
        maxDepthM: 42,
      },
      {
        id: 's2',
        name: 'Planier — Le Chaouen',
        region: 'Marseille',
        latitude: 43.199,
        longitude: 5.232,
        diveCount: 8,
        maxDepthM: 39.9,
      },
    ],
    frequentBuddies: [lucas],
    ...overrides,
  };
}
