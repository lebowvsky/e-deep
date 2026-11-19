import { describe, expect, it } from 'vitest';
import { mockSiteEntries } from '../mocks/siteEntries';
import {
  DEFAULT_SITE_LIST_QUERY,
  regionGroupOf,
  regionGroups,
  selectSites,
  toCompleteCount,
  zoneCounts,
  type SiteListQuery,
} from './siteList';

const names = (query: Partial<SiteListQuery>) =>
  selectSites(mockSiteEntries, { ...DEFAULT_SITE_LIST_QUERY, ...query }).map(
    ({ site }) => site.name,
  );

describe('siteList', () => {
  it('groups the regions by their broadest part', () => {
    expect(regionGroupOf('Calvi · Corse')).toBe('Corse');
    expect(regionGroupOf('Corse')).toBe('Corse');
    expect(regionGroupOf(null)).toBeNull();
    expect(regionGroups(mockSiteEntries)).toStrictEqual([
      'Bretagne',
      'Corse',
      'Esterel',
      'Marseille',
      'Var',
    ]);
  });

  it('sorts by dive count by default, then by name', () => {
    expect(names({}).slice(0, 4)).toStrictEqual([
      'La Gabinière',
      'Pointe de la Revellata',
      'Les Moyades',
      'Sec de la Croix',
    ]);
  });

  it('sorts by name, latest dive or deepest dive', () => {
    expect(names({ sort: 'name' })[0]).toBe('Cap Roux');
    // The first mocked site has the latest dive (offset 0).
    expect(names({ sort: 'last' })[0]).toBe('Pointe de la Revellata');
    // Revellata: 60 m (its usual range), the deepest.
    expect(names({ sort: 'depth' })[0]).toBe('Pointe de la Revellata');
    // A site without dive comes last.
    expect(names({ sort: 'depth' }).at(-1)).toBe('Revellata — Grotte aux Corbs');
  });

  it('filters by type, region and « À compléter »', () => {
    expect(names({ type: 'grotte' })).toStrictEqual(['Revellata — Grotte aux Corbs']);
    expect(names({ region: 'Esterel' })).toStrictEqual(['Cap Roux', 'Le Lion de Mer']);
    expect(names({ toComplete: true })).toStrictEqual(['Revellata — Grotte aux Corbs']);
    expect(names({ type: 'epave', region: 'Corse' })).toStrictEqual(['Épave du B-17']);
    expect(toCompleteCount(mockSiteEntries)).toBe(1);
  });

  it('searches tolerantly, best match first', () => {
    expect(names({ q: 'revelata' })).toStrictEqual([
      'Pointe de la Revellata',
      'Revellata — Grotte aux Corbs',
    ]);
    expect(names({ q: 'revel', toComplete: true })).toStrictEqual(['Revellata — Grotte aux Corbs']);
  });

  it('counts the sites of each zone that has some', () => {
    expect(zoneCounts(mockSiteEntries)).toStrictEqual([
      { zone: 'mediterranee', count: 18 },
      { zone: 'atlantique', count: 4 },
      { zone: 'manche', count: 2 },
    ]);
  });
});
