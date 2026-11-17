import { describe, expect, it } from 'vitest';
import { findTextMatch, isSameText } from './textMatch';

describe('findTextMatch', () => {
  it('finds the query ignoring case and accents, with the range in the original text', () => {
    const text = 'Pointe de la Révellata';
    const match = findTextMatch(text, 'revel');
    expect(match).toEqual({ start: 13, end: 18 });
    expect(text.slice(match?.start, match?.end)).toBe('Rével');
  });

  it('returns null for a blank or absent query', () => {
    expect(findTextMatch('Calvi', '  ')).toBeNull();
    expect(findTextMatch('Calvi', 'ajaccio')).toBeNull();
  });
});

describe('isSameText', () => {
  it('compares ignoring case, accents and surrounding spaces', () => {
    expect(isSameText(' Mérou brun', 'merou BRUN ')).toBe(true);
    expect(isSameText('Mérou', 'Mérou brun')).toBe(false);
  });
});
