import { describe, expect, it } from 'vitest';
import { hashOf } from './hash';

describe('hashOf', () => {
  it('matches the FNV-1a reference values', () => {
    expect(hashOf('')).toBe(0x811c9dc5);
    expect(hashOf('a')).toBe(0xe40c292c);
    expect(hashOf('foobar')).toBe(0xbf9cf968);
  });

  it('is an unsigned 32-bit integer', () => {
    for (const text of ['Ελλάδα', 'مصر', '🐠', 'Bretagne']) {
      const hash = hashOf(text);
      expect(Number.isInteger(hash)).toBe(true);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThan(2 ** 32);
    }
  });
});
