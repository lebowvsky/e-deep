import { describe, expect, it } from 'vitest';
import { toGeoPoint } from './geo';

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
