import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUERY,
  activeFilterKeys,
  parseDivesQuery,
  serializeDivesQuery,
  updateDivesQuery,
  withoutFilter,
  withoutFilters,
} from './query';

const parse = (search: string) => parseDivesQuery(new URLSearchParams(search));

describe('parseDivesQuery', () => {
  it('gives the defaults for an empty URL', () => {
    expect(parse('')).toEqual(DEFAULT_QUERY);
  });

  it('reads the example URL of the spec', () => {
    expect(
      parse(
        'q=épave&region=corse&depthMin=20&depthMax=40&gas=air&with=b1&sort=-date&page=2&size=10',
      ),
    ).toEqual({
      ...DEFAULT_QUERY,
      q: 'épave',
      regions: ['corse'],
      depthMin: 20,
      depthMax: 40,
      gases: ['air'],
      with: ['b1'],
      page: 2,
    });
  });

  it('reads lists, the period and the page size', () => {
    expect(parse('region=corse,var&gas=nitrox,other&with=b1,b2&period=2025&size=50')).toMatchObject(
      {
        regions: ['corse', 'var'],
        gases: ['nitrox', 'other'],
        with: ['b1', 'b2'],
        period: '2025',
        size: 50,
      },
    );
    expect(parse('period=12m').period).toBe('12m');
  });

  it('ignores invalid values', () => {
    expect(
      parse(
        'region=atlantis,corse,corse&gas=trimix&sort=name&page=-3&size=15&period=demain&depthMin=abc',
      ),
    ).toEqual({ ...DEFAULT_QUERY, regions: ['corse'] });
  });

  it('treats the ends of the depth scale as no bound and swaps reversed bounds', () => {
    expect(parse('depthMin=0&depthMax=60')).toMatchObject({ depthMin: null, depthMax: null });
    expect(parse('depthMin=40&depthMax=20')).toMatchObject({ depthMin: 20, depthMax: 40 });
  });
});

describe('serializeDivesQuery', () => {
  it('leaves the defaults out of the URL', () => {
    expect(serializeDivesQuery(DEFAULT_QUERY).toString()).toBe('');
  });

  it('round-trips a query and keeps the params it does not own', () => {
    const query = {
      ...DEFAULT_QUERY,
      q: 'mérou',
      regions: ['corse', 'var'] as const,
      depthMin: 20,
      with: ['b1'],
      sort: '-depth' as const,
      page: 3,
      size: 20 as const,
    };
    const params = serializeDivesQuery(
      { ...query, regions: [...query.regions] },
      new URLSearchParams('state=loading&page=9'),
    );
    expect(params.get('state')).toBe('loading');
    expect(params.get('region')).toBe('corse,var');
    expect(parseDivesQuery(params)).toEqual({ ...query, regions: ['corse', 'var'] });
  });
});

describe('updateDivesQuery', () => {
  const onPage3 = { ...DEFAULT_QUERY, page: 3 };

  it('goes back to page 1 when a filter, the sort or the page size changes', () => {
    expect(updateDivesQuery(onPage3, { regions: ['var'] }).page).toBe(1);
    expect(updateDivesQuery(onPage3, { sort: 'date' }).page).toBe(1);
    expect(updateDivesQuery(onPage3, { size: 50 }).page).toBe(1);
  });

  it('keeps the requested page when only the page changes', () => {
    expect(updateDivesQuery(onPage3, { page: 4 }).page).toBe(4);
  });
});

describe('filters', () => {
  const filtered = parse('q=épave&region=bretagne&depthMin=40&sort=-depth&size=20&page=2');

  it('lists the active filters in display order', () => {
    expect(activeFilterKeys(DEFAULT_QUERY)).toEqual([]);
    expect(activeFilterKeys(filtered)).toEqual(['q', 'regions', 'depth']);
  });

  it('removes one filter and goes back to page 1', () => {
    expect(withoutFilter(filtered, 'depth')).toMatchObject({
      q: 'épave',
      regions: ['bretagne'],
      depthMin: null,
      depthMax: null,
      page: 1,
    });
  });

  it('removes every filter but keeps the sort and the page size', () => {
    expect(withoutFilters(filtered)).toEqual({ ...DEFAULT_QUERY, sort: '-depth', size: 20 });
  });
});
