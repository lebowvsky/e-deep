/** Geographic window shown by the map placeholder (western Mediterranean). */
export interface MapBounds {
  west: number;
  east: number;
  north: number;
  south: number;
}

/**
 * Fixed bounding box. The north edge leaves room for the map header overlay.
 * When MapLibre replaces the placeholder, only `projectToMap` callers change.
 */
export const MAP_BOUNDS: MapBounds = { west: 2.6, east: 9.4, north: 44.1, south: 41.9 };

/** Position inside the map, as ratios of its width (x) and height (y), clamped to [0, 1]. */
export interface MapPoint {
  x: number;
  y: number;
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Equirectangular projection of a lat/lon onto the placeholder's box. */
export function projectToMap(
  latitude: number,
  longitude: number,
  bounds: MapBounds = MAP_BOUNDS,
): MapPoint {
  return {
    x: clamp((longitude - bounds.west) / (bounds.east - bounds.west)),
    y: clamp((bounds.north - latitude) / (bounds.north - bounds.south)),
  };
}
