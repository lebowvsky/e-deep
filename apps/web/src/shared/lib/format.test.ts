import { describe, expect, it } from 'vitest';
import {
  daysSince,
  formatDayCount,
  formatDiveCount,
  formatDiveDate,
  formatDiverLevel,
  formatHeaderDate,
  formatInitials,
  formatMonthInitial,
  formatMonthShort,
  formatNameList,
  formatShortName,
  formatUnderwaterTime,
  formatUtcOffset,
  splitMinutes,
} from './format';

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

  it('builds initials', () => {
    expect(formatInitials('Marine', 'Rousseau')).toBe('MR');
    expect(formatInitials('élise', 'marchand')).toBe('ÉM');
  });

  it('formats the diver level with the federation', () => {
    expect(formatDiverLevel('N2', 'FFESSM')).toBe('N2 · FFESSM');
    expect(formatDiverLevel('N1', 'OTHER')).toBe('N1 · Autre');
  });

  it('formats header date, month and initials in French', () => {
    expect(formatHeaderDate(new Date(2026, 3, 23, 14, 8))).toBe('jeu. 23 avr.');
    expect(formatMonthShort('2025-09-08T12:00:00Z')).toBe('sept.');
    expect(formatMonthInitial('août')).toBe('A');
    expect(formatMonthInitial('janv')).toBe('J');
  });

  it('formats the local UTC offset', () => {
    const at = (offsetMinutes: number) =>
      ({ getTimezoneOffset: () => offsetMinutes }) as unknown as Date;
    expect(formatUtcOffset(at(-120))).toBe('UTC+2');
    expect(formatUtcOffset(at(0))).toBe('UTC');
    expect(formatUtcOffset(at(210))).toBe('UTC-3:30');
  });

  it('formats counts and names', () => {
    expect(formatDayCount(1)).toBe('1 jour');
    expect(formatDayCount(14)).toBe('14 jours');
    expect(formatDiveCount(1)).toBe('1 plongée');
    expect(formatDiveCount(24)).toBe('24 plongées');
    expect(formatShortName('Lucas', 'Bernard')).toBe('L. Bernard');
    expect(formatNameList(['L. Bernard', 'T. Nguyen'])).toBe('L. Bernard & T. Nguyen');
    expect(formatNameList(['A', 'B', 'C'])).toBe('A, B & C');
    expect(formatNameList(['A'])).toBe('A');
  });
});
