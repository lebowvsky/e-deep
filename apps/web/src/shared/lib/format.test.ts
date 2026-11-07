import { describe, expect, it } from 'vitest';
import { daysSince, formatDiveDate, formatUnderwaterTime, splitMinutes } from './format';

describe('format', () => {
  it('splits minutes into hours and minutes', () => {
    expect(splitMinutes(5063)).toEqual({ hours: 84, minutes: 23 });
  });

  it('formats underwater time with zero-padded minutes', () => {
    expect(formatUnderwaterTime(5063)).toBe('84 h 23 min');
    expect(formatUnderwaterTime(65)).toBe('1 h 05 min');
  });

  it('formats a dive date in French', () => {
    expect(formatDiveDate('2025-09-08T10:00:00Z')).toBe('08 sept. 2025');
  });

  it('counts whole days since a date', () => {
    expect(daysSince('2025-09-08T00:00:00Z', new Date('2025-09-10T12:00:00Z'))).toBe(2);
  });
});
