import { describe, expect, it } from 'vitest';
import { isPositionPair } from './guards';

describe('isPositionPair', () => {
  it('accepts both coordinates, or neither (D-23)', () => {
    expect(isPositionPair(42.58, 8.72)).toBe(true);
    expect(isPositionPair(null, null)).toBe(true);
  });

  it.each([
    ['a latitude alone', 42.58, null],
    ['a longitude alone', null, 8.72],
    ['a string latitude', '42.58', 8.72],
    ['a missing longitude', 42.58, undefined],
    ['a non-finite latitude', Number.NaN, 8.72],
  ])('refuses %s', (_label, latitude, longitude) => {
    expect(isPositionPair(latitude, longitude)).toBe(false);
  });
});
