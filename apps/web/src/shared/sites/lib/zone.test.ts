import { describe, expect, it } from 'vitest';
import { mockSites } from '../mocks/sites';
import { deriveZone } from './zone';

describe('deriveZone', () => {
  it('reads the zone from the position', () => {
    expect(deriveZone({ latitude: 42.583, longitude: 8.725 }, null)).toBe('mediterranee');
    expect(deriveZone({ latitude: 48.588, longitude: -4.72 }, null)).toBe('manche');
    expect(deriveZone({ latitude: 48.308, longitude: -4.914 }, null)).toBe('atlantique');
    // Bay of Biscay (Biarritz) and Black Sea are not the Mediterranean.
    expect(deriveZone({ latitude: 43.48, longitude: -1.56 }, null)).toBe('atlantique');
    expect(deriveZone({ latitude: 43.2, longitude: 28.0 }, null)).toBe('autre');
    // Red Sea.
    expect(deriveZone({ latitude: 27.9, longitude: 34.3 }, 'Corse')).toBe('autre');
  });

  it('falls back on the words of the region without position', () => {
    expect(deriveZone(null, 'Calvi · Corse')).toBe('mediterranee');
    expect(deriveZone(null, 'Côte d’Azur')).toBe('mediterranee');
    expect(deriveZone(null, 'Perros-Guirec · Bretagne')).toBe('manche');
    expect(deriveZone(null, 'Morgat · Bretagne')).toBe('atlantique');
    // Brittany has both seas; « Varsovie » is not « Var ».
    expect(deriveZone(null, 'Bretagne')).toBe('autre');
    expect(deriveZone(null, 'Varsovie')).toBe('autre');
    expect(deriveZone(null, null)).toBe('autre');
  });

  it('agrees with the zones of the mocked sites', () => {
    for (const site of mockSites) {
      expect(deriveZone(site.position, site.region), site.name).toBe(site.zone);
    }
  });
});
