import { describe, expect, it } from 'vitest';
import {
  capitalize,
  formatDiveDayMonth,
  formatHoursMinutes,
  formatMonthYear,
  formatOneDecimal,
  formatWeekdayShort,
} from './format';

describe('dive log formatters', () => {
  it('formats the dive day from its own calendar date, whatever the offset', () => {
    expect(formatDiveDayMonth('2026-04-08T10:30:00+02:00')).toBe('08 avr.');
    // 23:30 in the Red Sea stays on the 14th even for a device in UTC−something.
    expect(formatDiveDayMonth('2026-07-14T23:30:00+03:00')).toBe('14 juil.');
    expect(formatWeekdayShort('2026-04-08T10:30:00+02:00')).toBe('mer.');
    expect(formatWeekdayShort('2025-12-28T09:00:00+01:00')).toBe('dim.');
  });

  it('formats a month and year', () => {
    expect(formatMonthYear('2026-04')).toBe('avril 2026');
    expect(capitalize(formatMonthYear('2025-12'))).toBe('Décembre 2025');
  });

  it('formats a cumulated duration in hours and minutes', () => {
    expect(formatHoursMinutes(5063)).toBe('84 h 23');
    expect(formatHoursMinutes(44)).toBe('0 h 44');
    expect(formatHoursMinutes(177)).toBe('2 h 57');
  });

  it('formats one decimal the French way', () => {
    expect(formatOneDecimal(24.598)).toBe('24,6');
    expect(formatOneDecimal(30)).toBe('30,0');
  });
});
