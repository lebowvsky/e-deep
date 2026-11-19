import { describe, expect, it } from 'vitest';
import { distanceKm, toGeoPoint } from './geo';

describe('toGeoPoint', () => {
  it('pairs both coordinates', () => {
    expect(toGeoPoint(42.58, 8.72)).toEqual({ latitude: 42.58, longitude: 8.72 });
  });

  it('gives no position rather than half of one', () => {
    expect(toGeoPoint(null, null)).toBeNull();
    expect(toGeoPoint(42.58, null)).toBeNull();
    expect(toGeoPoint(null, 8.72)).toBeNull();
  });
});

describe('distanceKm', () => {
  it('is zero between a point and itself', () => {
    expect(
      distanceKm({ latitude: 42.58, longitude: 8.72 }, { latitude: 42.58, longitude: 8.72 }),
    ).toBe(0);
  });

  it('measures the great-circle distance', () => {
    // Calvi (Revellata) → Marseille (Frioul): about 300 km.
    const revellata = { latitude: 42.583, longitude: 8.725 };
    const frioul = { latitude: 43.2617, longitude: 5.2958 };
    expect(distanceKm(revellata, frioul)).toBeCloseTo(289, 0);
    // One degree of latitude: 111.2 km.
    expect(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })).toBeCloseTo(
      111.2,
      1,
    );
  });
});
