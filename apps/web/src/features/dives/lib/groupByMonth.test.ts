import { describe, expect, it } from 'vitest';
import { makeDive } from '../mocks/diveFixture';
import { groupByMonth, isGroupedByMonth } from './groupByMonth';
import { summarize } from './selectDives';

describe('groupByMonth', () => {
  const april = [
    makeDive({ number: 4, date: '2026-04-08T10:30:00+02:00', durationMin: 38 }),
    makeDive({ number: 3, date: '2026-04-07T14:30:00+02:00', durationMin: 46 }),
  ];
  const march = [makeDive({ number: 2, date: '2026-03-22T09:30:00+01:00', durationMin: 40 })];
  const selection = [
    ...april,
    ...march,
    makeDive({ number: 1, date: '2026-03-01T10:00:00+01:00' }),
  ];

  it('groups consecutive dives of the same month, with the totals of the whole selection', () => {
    // The page holds 3 of the 4 dives: March keeps its 2 dives in its header.
    const groups = groupByMonth([...april, ...march], summarize(selection).byMonth);
    expect(groups.map(({ month, total, dives }) => [month, total, dives.length])).toEqual([
      ['2026-04', { count: 2, minutes: 84 }, 2],
      ['2026-03', { count: 2, minutes: 85 }, 1],
    ]);
  });

  it('groups by the dive’s own calendar month, whatever the offset', () => {
    const lateNight = makeDive({ number: 1, date: '2026-03-31T23:30:00+03:00' });
    expect(groupByMonth([lateNight], summarize([lateNight]).byMonth)[0]?.month).toBe('2026-03');
  });

  it('only applies to the date sorts', () => {
    expect(isGroupedByMonth('-date')).toBe(true);
    expect(isGroupedByMonth('date')).toBe(true);
    expect(isGroupedByMonth('-depth')).toBe(false);
    expect(isGroupedByMonth('-duration')).toBe(false);
  });
});
