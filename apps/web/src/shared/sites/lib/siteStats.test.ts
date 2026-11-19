import { describe, expect, it } from 'vitest';
import type { SiteDive } from '@/shared/model/site';
import { computeSiteStats } from './siteStats';

function dive(overrides: Partial<SiteDive> & Pick<SiteDive, 'id' | 'number' | 'date'>): SiteDive {
  return {
    depthMaxM: 30,
    durationMin: 40,
    temperatureC: null,
    entryType: null,
    diveCenter: null,
    buddies: [],
    ...overrides,
  };
}

describe('computeSiteStats', () => {
  it('sums up the dives of the site, in any order', () => {
    const stats = computeSiteStats([
      dive({
        id: 'd2',
        number: 40,
        date: '2025-06-12T10:00:00+02:00',
        depthMaxM: 38,
        durationMin: 42,
        temperatureC: 19,
        entryType: 'BOAT',
        diveCenter: 'Calvi Plongée',
      }),
      dive({
        id: 'd4',
        number: 127,
        date: '2026-04-08T10:30:00+02:00',
        depthMaxM: 42,
        durationMin: 38,
        temperatureC: 14,
        entryType: 'BOAT',
        diveCenter: 'Calvi Plongée',
      }),
      dive({
        id: 'd1',
        number: 12,
        date: '2024-06-26T14:30:00+02:00',
        depthMaxM: 35,
        durationMin: 30,
        temperatureC: 13,
        entryType: 'SHORE',
      }),
      dive({
        id: 'd3',
        number: 90,
        date: '2025-09-01T09:00:00+02:00',
        depthMaxM: 25,
        durationMin: 51,
        diveCenter: 'Stareso',
      }),
    ]);

    expect(stats).toStrictEqual({
      diveCount: 4,
      firstDiveDate: '2024-06-26T14:30:00+02:00',
      lastDive: { id: 'd4', number: 127, date: '2026-04-08T10:30:00+02:00' },
      maxDepth: { depthM: 42, number: 127, date: '2026-04-08T10:30:00+02:00' },
      totalMinutes: 161,
      averageMinutes: 40,
      // Over the 3 dives with a temperature: (19 + 14 + 13) / 3.
      bottomTemperature: { averageC: 15.3, minC: 13, maxC: 19 },
      usualEntryType: 'BOAT',
      usualDiveCenter: 'Calvi Plongée',
    });
  });

  it('keeps the latest dive on a tie (deepest, usual values)', () => {
    const stats = computeSiteStats([
      dive({
        id: 'old',
        number: 1,
        date: '2024-01-01T10:00:00+01:00',
        depthMaxM: 30,
        entryType: 'SHORE',
        diveCenter: 'A',
      }),
      dive({
        id: 'new',
        number: 2,
        date: '2025-01-01T10:00:00+01:00',
        depthMaxM: 30,
        entryType: 'BOAT',
        diveCenter: 'B',
      }),
    ]);
    expect(stats.maxDepth).toStrictEqual({
      depthM: 30,
      number: 2,
      date: '2025-01-01T10:00:00+01:00',
    });
    expect(stats.usualEntryType).toBe('BOAT');
    expect(stats.usualDiveCenter).toBe('B');
  });

  it('has nothing to say without dive', () => {
    expect(computeSiteStats([])).toStrictEqual({
      diveCount: 0,
      firstDiveDate: null,
      lastDive: null,
      maxDepth: null,
      totalMinutes: 0,
      averageMinutes: null,
      bottomTemperature: null,
      usualEntryType: null,
      usualDiveCenter: null,
    });
  });
});
