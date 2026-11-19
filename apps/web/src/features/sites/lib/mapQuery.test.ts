import { describe, expect, it } from 'vitest';
import { panelKey, parseMapQuery, serializeMapQuery } from './mapQuery';

const parse = (search: string) => parseMapQuery(new URLSearchParams(search));

describe('mapQuery', () => {
  it('reads the site, the zone and the panel', () => {
    expect(parse('?site=s01&zone=manche')).toStrictEqual({
      siteId: 's01',
      zone: 'manche',
      panel: null,
    });
    expect(parse('?panel=new').panel).toStrictEqual({ kind: 'new' });
    expect(parse('?panel=place&id=s24').panel).toStrictEqual({ kind: 'place', id: 's24' });
    expect(parse('?panel=edit&id=s01').panel).toStrictEqual({ kind: 'edit', id: 's01' });
  });

  it('ignores what it does not know', () => {
    expect(parse('?zone=bretagne&panel=edit&site=')).toStrictEqual({
      siteId: null,
      zone: null,
      panel: null,
    });
  });

  it('writes the query back, other parameters kept', () => {
    const params = serializeMapQuery(
      { siteId: 's01', zone: null, panel: { kind: 'edit', id: 's01' } },
      new URLSearchParams('?zone=manche&state=ready'),
    );
    expect(params.toString()).toBe('state=ready&site=s01&panel=edit&id=s01');
  });

  it('keys a panel by kind and site', () => {
    expect(panelKey(null)).toBeNull();
    expect(panelKey({ kind: 'new' })).toBe('new');
    expect(panelKey({ kind: 'place', id: 's24' })).toBe('place:s24');
  });
});
