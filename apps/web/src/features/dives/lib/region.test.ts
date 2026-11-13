import { describe, expect, it } from 'vitest';
import { isRegionKey, toRegionKey } from './region';

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
    ['!!!', ''],
  ])('« %s » → %s', (name, key) => {
    expect(toRegionKey(name)).toBe(key);
  });

  it('gives the same key to the same region written differently', () => {
    expect(toRegionKey('CÔTE D’AZUR')).toBe(toRegionKey('cote d azur'));
  });

  it('always produces a key that the URL accepts back', () => {
    for (const name of ['Bretagne', 'Côte d’Azur', 'Égypte (Mer Rouge)', ' Açores ']) {
      expect(isRegionKey(toRegionKey(name))).toBe(true);
    }
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
