import { numericTransformer } from './numeric.transformer';

describe('numericTransformer', () => {
  it('reads a numeric string as a number', () => {
    expect(numericTransformer.from('43.123456')).toBe(43.123456);
    expect(numericTransformer.from('-12.5')).toBe(-12.5);
  });

  it('keeps null', () => {
    expect(numericTransformer.from(null)).toBeNull();
    expect(numericTransformer.to(null)).toBeNull();
  });

  it('writes numbers unchanged', () => {
    expect(numericTransformer.to(30.5)).toBe(30.5);
  });
});
