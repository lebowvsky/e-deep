import { describe, expect, it } from 'vitest';
import { MOCK_SITES, mockSites } from '../mocks/sites';
import { suggestRegion } from './suggestRegion';

describe('suggestRegion', () => {
  it('suggests the region of the closest placed site', () => {
    // Below the lighthouse of the Revellata, 400 m from s01: Calvi.
    expect(suggestRegion({ latitude: 42.5794, longitude: 8.7262 }, mockSites)).toBe(
      'Calvi · Corse',
    );
    // Between Porquerolles (Donator, Sarranier) and Port-Cros (Gabinière), closer to Sarranier.
    expect(suggestRegion({ latitude: 42.99, longitude: 6.25 }, mockSites)).toBe(
      'Porquerolles · Var',
    );
  });

  it('suggests nothing beyond 15 km', () => {
    // Ajaccio: 50 km from Scandola, the closest mocked site.
    expect(suggestRegion({ latitude: 41.92, longitude: 8.73 }, mockSites)).toBeNull();
    expect(suggestRegion({ latitude: 42.58, longitude: 8.72 }, [])).toBeNull();
  });

  it('skips the sites without position or region, and the site being edited', () => {
    const near = { latitude: 42.583, longitude: 8.725 };
    const unnamed = { ...MOCK_SITES.revellata, region: null };
    expect(suggestRegion(near, [unnamed, MOCK_SITES.grotteAuxCorbs])).toBeNull();
    expect(suggestRegion(near, [MOCK_SITES.revellata], 's01')).toBeNull();
    expect(suggestRegion(near, [MOCK_SITES.revellata, MOCK_SITES.bibliotheque], 's01')).toBe(
      'Calvi · Corse',
    );
  });
});
