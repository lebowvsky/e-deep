import { describe, expect, it } from 'vitest';
import { mockSites } from '../mocks/sites';
import { searchSites, searchWords } from './searchSites';

// Dive counts of the site list mockup (Revellata 8, Gabinière 11…), the rest at 1.
const DIVE_COUNTS: Readonly<Record<string, number>> = { s01: 8, s02: 3, s11: 11, s24: 0 };
const sites = mockSites.map((site) => ({ ...site, diveCount: DIVE_COUNTS[site.id] ?? 1 }));

const namesFor = (query: string): string[] => searchSites(sites, query).map(({ name }) => name);

describe('searchWords', () => {
  it('folds case and accents and drops the articles', () => {
    expect(searchWords('Pointe de la Revellata')).toStrictEqual(['pointe', 'de', 'revellata']);
    expect(searchWords('L’Impérial de Terre')).toStrictEqual(['imperial', 'de', 'terre']);
    expect(searchWords("l'Épave LES Moyades")).toStrictEqual(['epave', 'moyades']);
  });
});

describe('searchSites', () => {
  it('finds a site from the beginning of a word, the name starting with it first', () => {
    expect(namesFor('revel')).toStrictEqual([
      'Revellata — Grotte aux Corbs',
      'Pointe de la Revellata',
    ]);
  });

  it('ignores the articles of the query', () => {
    expect(namesFor('la revellata')).toStrictEqual([
      'Revellata — Grotte aux Corbs',
      'Pointe de la Revellata',
    ]);
    expect(namesFor('la gabiniere')).toStrictEqual(['La Gabinière']);
  });

  it('tolerates one typo on words of 5 letters or more', () => {
    expect(namesFor('revelata')).toStrictEqual([
      'Pointe de la Revellata',
      'Revellata — Grotte aux Corbs',
    ]);
    expect(namesFor('gabinere')).toStrictEqual(['La Gabinière']);
  });

  it('wants short words typed right', () => {
    expect(namesFor('sex')).toStrictEqual([]);
    expect(namesFor('sec')).toStrictEqual(['Sec de la Croix', 'Sec du Sarranier']);
  });

  it('ranks a whole word before a partial one, then by dive count', () => {
    const ranked = searchSites(
      [
        { name: 'Épave du Donatorien', diveCount: 9 },
        { name: 'Le Donator', diveCount: 1 },
        { name: 'Grand Donator', diveCount: 4 },
      ],
      'donator',
    ).map(({ name }) => name);
    // « Le Donator » starts with the query (article ignored), then the whole words, then partial.
    expect(ranked).toStrictEqual(['Le Donator', 'Grand Donator', 'Épave du Donatorien']);
  });

  it('needs every word of the query', () => {
    expect(namesFor('pointe revel')).toStrictEqual(['Pointe de la Revellata']);
    expect(namesFor('pointe corbs')).toStrictEqual([]);
  });

  it('keeps every site, most dived first, for a blank query', () => {
    const all = searchSites(sites, '  la ');
    expect(all).toHaveLength(sites.length);
    expect(all.slice(0, 3).map(({ name }) => name)).toStrictEqual([
      'La Gabinière',
      'Pointe de la Revellata',
      'La Bibliothèque',
    ]);
  });
});
