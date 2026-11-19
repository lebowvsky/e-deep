import { describe, expect, it } from 'vitest';
import {
  formatCoordinate,
  formatPosition,
  parseCoordinate,
  parseCoordinatePair,
  readCoordinateFields,
  toCoordinateFields,
} from './coordinates';

describe('coordinates', () => {
  it('shows 4 decimals', () => {
    expect(formatCoordinate(42.57941)).toBe('42.5794');
    expect(formatCoordinate(-4.72)).toBe('-4.7200');
    expect(formatPosition({ latitude: 42.5794, longitude: 8.7262 })).toBe('42.5794° N · 8.7262° E');
    expect(formatPosition({ latitude: 48.588, longitude: -4.72 })).toBe('48.5880° N · 4.7200° W');
  });

  it('reads one coordinate, dot or comma, within its range', () => {
    expect(parseCoordinate('42.5794', 'latitude')).toBe(42.5794);
    expect(parseCoordinate(' 8,7262 ', 'longitude')).toBe(8.7262);
    expect(parseCoordinate('-4.72', 'longitude')).toBe(-4.72);
    expect(parseCoordinate('91', 'latitude')).toBeNull();
    expect(parseCoordinate('120', 'longitude')).toBe(120);
    expect(parseCoordinate('42°N', 'latitude')).toBeNull();
    expect(parseCoordinate('', 'latitude')).toBeNull();
  });

  it('reads a pasted decimal pair', () => {
    expect(parseCoordinatePair('42.5794, 8.7262')).toEqual({
      latitude: 42.5794,
      longitude: 8.7262,
    });
    expect(parseCoordinatePair('42.5794 8.7262')).toEqual({ latitude: 42.5794, longitude: 8.7262 });
    expect(parseCoordinatePair('42,5794, 8,7262')).toEqual({
      latitude: 42.5794,
      longitude: 8.7262,
    });
    expect(parseCoordinatePair('48.588;-4.72')).toEqual({ latitude: 48.588, longitude: -4.72 });
  });

  it('reads a pasted pair in degrees and minutes, or seconds', () => {
    const minutes = parseCoordinatePair("42°34.764'N 8°43.572'E");
    expect(minutes?.latitude).toBeCloseTo(42.5794, 4);
    expect(minutes?.longitude).toBeCloseTo(8.7262, 4);
    const seconds = parseCoordinatePair('48°35\'16.8"N 4°43\'12"W');
    expect(seconds?.latitude).toBeCloseTo(48.588, 4);
    expect(seconds?.longitude).toBeCloseTo(-4.72, 4);
    // « O » for ouest.
    expect(parseCoordinatePair("48°35.28'N 4°43.2'O")?.longitude).toBeCloseTo(-4.72, 4);
  });

  it('refuses what is not a pair, or out of range', () => {
    expect(parseCoordinatePair('Calvi')).toBeNull();
    expect(parseCoordinatePair('42.5794')).toBeNull();
    expect(parseCoordinatePair('95, 8')).toBeNull();
  });

  it('goes between a position and the two fields', () => {
    expect(toCoordinateFields({ latitude: 42.5794, longitude: 8.7262 })).toEqual({
      latitude: '42.5794',
      longitude: '8.7262',
    });
    expect(toCoordinateFields(null)).toEqual({ latitude: '', longitude: '' });
    expect(readCoordinateFields({ latitude: '42.5794', longitude: '8,7262' })).toEqual({
      latitude: 42.5794,
      longitude: 8.7262,
    });
    expect(readCoordinateFields({ latitude: ' ', longitude: '' })).toBeNull();
    expect(readCoordinateFields({ latitude: '42.5', longitude: '' })).toBe('invalid');
  });
});
