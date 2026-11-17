import { describe, expect, it } from 'vitest';
import {
  durationFromTimes,
  exitFromDuration,
  parseClock,
  parseDay,
  parseInterval,
  splitLocalIso,
  toDayValue,
  toLocalIso,
} from './timeLink';

describe('clock and day values', () => {
  it('reads the native time and date inputs', () => {
    expect(parseClock('10:05')).toBe(605);
    expect(parseClock('00:00')).toBe(0);
    expect(parseClock('23:59')).toBe(1439);
    expect(parseClock('24:00')).toBeNull();
    expect(parseClock('9:05')).toBeNull();
    expect(parseClock('')).toBeNull();
    expect(parseDay('2026-04-09')).toEqual([2026, 4, 9]);
    expect(parseDay('2026-02-30')).toBeNull();
    expect(parseDay('09/04/2026')).toBeNull();
  });

  it('gives the device day of a date', () => {
    expect(toDayValue(new Date(2026, 3, 9, 23, 30))).toBe('2026-04-09');
  });

  it('writes and reads the local ISO date of the API (D-10)', () => {
    expect(toLocalIso('2026-04-09', '10:05', 120)).toBe('2026-04-09T10:05:00+02:00');
    expect(toLocalIso('2026-04-09', '10:05', -210)).toBe('2026-04-09T10:05:00-03:30');
    expect(toLocalIso('2026-04-09', '', 120)).toBeNull();
    expect(splitLocalIso('2026-04-09T10:05:00+02:00')).toEqual({
      day: '2026-04-09',
      clock: '10:05',
    });
  });

  it('reads the surface interval as h:mm', () => {
    expect(parseInterval('1:30')).toBe(90);
    expect(parseInterval('12:05')).toBe(725);
    expect(parseInterval('1h30')).toBeNull();
    expect(parseInterval('1:75')).toBeNull();
  });
});

describe('duration ↔ times', () => {
  it('computes the duration from the times', () => {
    expect(durationFromTimes('10:05', '10:49', false)).toBe(44);
  });

  it('computes the exit from the duration', () => {
    expect(exitFromDuration('10:05', 44, false)).toBe('10:49');
  });

  it('goes past midnight for a night dive, both ways', () => {
    expect(durationFromTimes('23:30', '00:15', true)).toBe(45);
    expect(exitFromDuration('23:30', 45, true)).toBe('00:15');
  });

  it('refuses to go past midnight without Nuit', () => {
    expect(durationFromTimes('23:30', '00:15', false)).toBeNull();
    expect(exitFromDuration('23:30', 45, false)).toBeNull();
  });

  it('refuses an exit equal to the immersion by day, and incomplete values', () => {
    expect(durationFromTimes('10:05', '10:05', false)).toBeNull();
    expect(durationFromTimes('10:05', '', false)).toBeNull();
    expect(exitFromDuration('10:05', null, false)).toBeNull();
    expect(exitFromDuration('10:05', 0, false)).toBeNull();
    expect(exitFromDuration('10:05', 12.5, false)).toBeNull();
  });
});
