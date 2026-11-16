import { describe, expect, it } from 'vitest';
import { makeDive } from '../mocks/diveFixture';
import { DEFAULT_QUERY, parseDivesQuery, serializeDivesQuery } from './query';
import { isRegionKey, toRegionKey } from './region';
import { matchesQuery } from './selectDives';

describe('toRegionKey', () => {
  it.each([
    ['Bretagne', 'bretagne'],
    ['Corse', 'corse'],
    ['Côte d’Azur', 'cote-d-azur'],
    ["Côte d'Azur", 'cote-d-azur'],
    ['Île-de-France', 'ile-de-france'],
    ['  Mer   Rouge  ', 'mer-rouge'],
    ['Égypte (Mer Rouge)', 'egypte-mer-rouge'],
    ['Lac Léman / Suisse', 'lac-leman-suisse'],
    ['Zone 51', 'zone-51'],
  ])('« %s » → %s', (name, key) => {
    expect(toRegionKey(name)).toBe(key);
  });

  it('gives the same key to the same region written differently', () => {
    expect(toRegionKey('CÔTE D’AZUR')).toBe(toRegionKey('cote d azur'));
  });

  it('always produces a key that the URL accepts back', () => {
    for (const name of [
      'Bretagne',
      'Côte d’Azur',
      'Égypte (Mer Rouge)',
      ' Açores ',
      'Ελλάδα',
      'مصر',
      '🐠',
      '!!!',
      '',
      'Ísafjörður',
    ]) {
      expect(isRegionKey(toRegionKey(name))).toBe(true);
    }
  });

  it.each(['Ελλάδα', 'مصر', '🐠', '!!!', '沖縄'])(
    'falls back to a hashed key for « %s », which the slug cannot spell',
    (name) => {
      expect(toRegionKey(name)).toMatch(/^r-[a-z0-9]+$/);
    },
  );

  it('gives distinct keys to distinct names the slug cannot spell', () => {
    const names = ['Ελλάδα', 'مصر', '🐠', '沖縄', 'Ελλάδα 2', 'مصر 2', 'Ísafjörður', 'Isafjordur'];
    const keys = names.map(toRegionKey);
    expect(new Set(keys).size).toBe(names.length);
  });

  it('keeps the hashed key stable for the same name written differently', () => {
    expect(toRegionKey('Ελλάδα')).toBe(toRegionKey('  ΕΛΛΑΔΑ '));
    expect(toRegionKey('مِصْر')).toBe(toRegionKey('مصر'));
  });
});

describe('a non-Latin region in the URL', () => {
  const greece = { id: 's90', name: 'Kyra Leni', place: 'Ελλάδα', regionName: 'Ελλάδα' };
  const egypt = { id: 's91', name: 'Thistlegorm', place: 'مصر', regionName: 'مصر' };
  const greekDive = makeDive({ number: 1, site: { ...greece, region: toRegionKey('Ελλάδα') } });
  const egyptianDive = makeDive({ number: 2, site: { ...egypt, region: toRegionKey('مصر') } });

  it('survives the round trip and still filters the log', () => {
    const query = { ...DEFAULT_QUERY, regions: [greekDive.site.region] };
    const params = new URLSearchParams(serializeDivesQuery(query).toString());

    expect(params.get('region')).toBe(greekDive.site.region);
    const parsed = parseDivesQuery(params);
    expect(parsed.regions).toEqual([greekDive.site.region]);

    const matches = matchesQuery(parsed, new Date(2026, 3, 10));
    expect([greekDive, egyptianDive].filter(matches)).toEqual([greekDive]);
  });
});

describe('isRegionKey', () => {
  it.each(['corse', 'cote-d-azur', 'zone-51'])('accepts %s', (key) => {
    expect(isRegionKey(key)).toBe(true);
  });

  it.each(['', 'Corse', 'côte', '-corse', 'corse-', 'cote--azur', 'mer rouge'])(
    'rejects « %s »',
    (key) => {
      expect(isRegionKey(key)).toBe(false);
    },
  );
});
