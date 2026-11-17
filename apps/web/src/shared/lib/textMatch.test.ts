import { describe, expect, it } from 'vitest';
import { findTextMatch, foldText, isSameText, matchesText } from './textMatch';

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

describe('foldText', () => {
  it('drops case and accents', () => {
    expect(foldText('Épave du Grec')).toBe('epave du grec');
  });
});

describe('matchesText', () => {
  it('agrees with findTextMatch, from a text folded once', () => {
    const folded = foldText('Pointe de la Révellata');
    expect(matchesText(folded, ' REVEL ')).toBe(true);
    expect(matchesText(folded, 'ajaccio')).toBe(false);
    expect(matchesText(folded, '  ')).toBe(false);
  });
});

describe('isSameText', () => {
  it('compares ignoring case, accents and surrounding spaces', () => {
    expect(isSameText(' Mérou brun', 'merou BRUN ')).toBe(true);
    expect(isSameText('Mérou', 'Mérou brun')).toBe(false);
  });
});
