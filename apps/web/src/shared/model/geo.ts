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
