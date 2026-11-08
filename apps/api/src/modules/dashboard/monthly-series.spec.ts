import { fillMonthlySeries, lastTwelveMonths, seriesLowerBound } from './monthly-series';

describe('monthly series', () => {
  it('lists the last 12 months, oldest first, across a year boundary', () => {
    const months = lastTwelveMonths(new Date('2026-02-15T10:00:00.000Z'));
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2025-03');
    expect(months.at(-1)).toBe('2026-02');
  });

  it('fills missing months with zero', () => {
    expect(fillMonthlySeries(['2026-01', '2026-02', '2026-03'], new Map([['2026-02', 4]]))).toEqual(
      [
        { month: '2026-01', count: 0 },
        { month: '2026-02', count: 4 },
        { month: '2026-03', count: 0 },
      ],
    );
  });

  it('starts the SQL window one day before the first month', () => {
    expect(seriesLowerBound(new Date('2026-11-08T00:00:00.000Z'))).toEqual(
      new Date('2025-11-30T00:00:00.000Z'),
    );
  });
});
