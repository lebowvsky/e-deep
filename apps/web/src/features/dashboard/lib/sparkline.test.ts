import { describe, expect, it } from 'vitest';
import { cumulative, sparklinePath } from './sparkline';

describe('sparkline', () => {
  it('spans the viewBox, lowest value at the bottom inset', () => {
    expect(sparklinePath([0, 10])).toBe('M0.0 26.0 L120.0 4.0');
  });

  it('draws a flat series in the middle-bottom without dividing by zero', () => {
    expect(sparklinePath([5, 5])).toBe('M0.0 26.0 L120.0 26.0');
  });

  it('needs at least two points', () => {
    expect(sparklinePath([3])).toBe('');
  });

  it('accumulates a series', () => {
    expect(cumulative([2, 4, 7])).toEqual([2, 6, 13]);
  });
});
