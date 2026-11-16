import { describe, expect, it } from 'vitest';
import { formatCoordinates, spokenCoordinates } from './geo';

describe('site coordinates', () => {
  it('prints three decimals with the hemispheres', () => {
    expect(formatCoordinates(42.58, 8.725)).toBe('42.580° N · 8.725° E');
    expect(formatCoordinates(-8.1, -34.9)).toBe('8.100° S · 34.900° W');
  });

  it('gives no southern or western sign to a value that rounds to zero', () => {
    expect(formatCoordinates(-0.0004, -0.0001)).toBe('0.000° N · 0.000° E');
    expect(spokenCoordinates(-0.0004, -0.0001)).toBe('Latitude 0,000 nord, longitude 0,000 est');
  });

  it('spells the hemispheres out for screen readers, with a French decimal comma', () => {
    expect(spokenCoordinates(42.58, 8.725)).toBe('Latitude 42,580 nord, longitude 8,725 est');
    expect(spokenCoordinates(-8.1, -34.9)).toBe('Latitude 8,100 sud, longitude 34,900 ouest');
  });
});
