import { describe, expect, it } from 'vitest';
import { formatCoordinates, spokenCoordinates } from './geo';

describe('site coordinates', () => {
  it('prints three decimals with the hemispheres', () => {
    expect(formatCoordinates(42.58, 8.725)).toBe('42.580° N · 8.725° E');
    expect(formatCoordinates(-8.1, -34.9)).toBe('8.100° S · 34.900° W');
  });

  it('spells the hemispheres out for screen readers', () => {
    expect(spokenCoordinates(42.58, 8.725)).toBe('Latitude 42.580 nord, longitude 8.725 est');
    expect(spokenCoordinates(-8.1, -34.9)).toBe('Latitude 8.100 sud, longitude 34.900 ouest');
  });
});
