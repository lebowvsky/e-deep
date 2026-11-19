// Position of a dive site, shared by the dashboard map and the dive detail.

/** WGS84 coordinates of a site, in degrees. */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/** The contract pairs both coordinates (D-23): no position rather than half of one. */
export function toGeoPoint(latitude: number | null, longitude: number | null): GeoPoint | null {
  return latitude === null || longitude === null ? null : { latitude, longitude };
}

const EARTH_RADIUS_KM = 6371;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance (haversine), in km. */
export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
