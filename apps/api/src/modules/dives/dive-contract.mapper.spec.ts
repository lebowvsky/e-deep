import { toLocalDateTime } from './dive-contract.mapper';

describe('toLocalDateTime', () => {
  it('shows the local time of the dive with its offset', () => {
    // 21:00 in the Red Sea (UTC+3) is 18:00 UTC.
    expect(toLocalDateTime(new Date('2026-07-14T18:00:00.000Z'), 180)).toBe(
      '2026-07-14T21:00:00+03:00',
    );
  });

  it('handles negative and non-whole-hour offsets', () => {
    expect(toLocalDateTime(new Date('2026-03-01T02:30:00.000Z'), -300)).toBe(
      '2026-02-28T21:30:00-05:00',
    );
    expect(toLocalDateTime(new Date('2026-03-01T00:00:00.000Z'), 345)).toBe(
      '2026-03-01T05:45:00+05:45',
    );
    expect(toLocalDateTime(new Date('2026-03-01T10:00:00.000Z'), -570)).toBe(
      '2026-03-01T00:30:00-09:30',
    );
  });

  it('keeps the instant: parsing the result gives back startedAt', () => {
    const startedAt = new Date('2026-07-14T18:07:42.000Z');
    expect(new Date(toLocalDateTime(startedAt, 840)).getTime()).toBe(startedAt.getTime());
    expect(toLocalDateTime(startedAt, 0)).toBe('2026-07-14T18:07:42+00:00');
  });
});
