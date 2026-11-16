import { describe, expect, it } from 'vitest';
import {
  formatDiveLongDate,
  formatExitTime,
  formatImmersionTime,
  formatRecordDates,
} from './diveTime';

describe('dive times, in the dive-site local time', () => {
  it('reads the wall clock of the site from the instant and its offset', () => {
    // 12:20 UTC in Calvi (UTC+2) is 14:20 there, whatever the device time zone.
    expect(formatImmersionTime('2026-04-08T12:20:00Z', 120)).toBe('14:20');
    expect(formatImmersionTime('2026-04-08T14:20:00+02:00', 120)).toBe('14:20');
    expect(formatDiveLongDate('2026-04-08T14:20:00+02:00', 120)).toBe('mer. 08 avr. 2026');
  });

  it('keeps the calendar day of the site, not the UTC one', () => {
    // 22:50 UTC on the 8th is 00:50 on the 9th in Calvi.
    expect(formatDiveLongDate('2026-04-08T22:50:00Z', 120)).toBe('jeu. 09 avr. 2026');
    expect(formatImmersionTime('2026-04-08T22:50:00Z', 120)).toBe('00:50');
    // A night dive in the Caribbean (UTC−4), late in the evening there.
    expect(formatDiveLongDate('2026-01-10T01:30:00Z', -240)).toBe('ven. 09 janv. 2026');
    expect(formatImmersionTime('2026-01-10T01:30:00Z', -240)).toBe('21:30');
  });

  it('gives the exit time from the start and the duration, across midnight too', () => {
    expect(formatExitTime('2026-04-08T14:20:00+02:00', 120, 38)).toBe('14:58');
    expect(formatExitTime('2026-04-08T23:40:00+02:00', 120, 38)).toBe('00:18');
    expect(formatExitTime('2026-04-08T14:20:00+02:00', 120, 0)).toBe('14:20');
  });
});

describe('record dates, in the device time zone', () => {
  it('gives the creation day, and the change day only when it differs', () => {
    expect(
      formatRecordDates('2026-04-08T18:00:00Z', '2026-04-09T07:30:00Z', 'Europe/Paris'),
    ).toStrictEqual({ created: '08 avr. 2026', modified: '09 avr.' });
    expect(
      formatRecordDates('2026-04-08T08:00:00Z', '2026-04-08T20:00:00Z', 'Europe/Paris'),
    ).toStrictEqual({ created: '08 avr. 2026', modified: null });
  });

  it('reads the days in the given zone, not in UTC nor the dive offset', () => {
    // 23:30 UTC on the 8th is already the 9th in Paris: same day as the change.
    expect(
      formatRecordDates('2026-04-08T23:30:00Z', '2026-04-09T10:00:00Z', 'Europe/Paris'),
    ).toStrictEqual({ created: '09 avr. 2026', modified: null });
  });

  it('keeps the year of a change made another year', () => {
    expect(
      formatRecordDates('2025-12-30T10:00:00Z', '2026-01-02T10:00:00Z', 'Europe/Paris'),
    ).toStrictEqual({ created: '30 déc. 2025', modified: '02 janv. 2026' });
  });
});
