// No geocoding in V1: the region of a new position is the one of the closest site already placed.
import { distanceKm, type GeoPoint } from '@/shared/model/geo';
import type { Site } from '@/shared/model/site';

/** Beyond this distance, the closest site says nothing about the new one. */
export const REGION_SUGGESTION_RADIUS_KM = 15;

/**
 * The region of the closest placed site with a region, when it is less than 15 km away; `null`
 * otherwise. `exceptId`: the site being edited, which must not suggest its own region.
 */
export function suggestRegion(
  position: GeoPoint,
  sites: readonly Site[],
  exceptId: string | null = null,
): string | null {
  let best: { region: string; distance: number } | null = null;
  for (const site of sites) {
    if (site.id === exceptId || site.position === null || site.region === null) continue;
    const distance = distanceKm(position, site.position);
    if (distance < REGION_SUGGESTION_RADIUS_KM && (best === null || distance < best.distance)) {
      best = { region: site.region, distance };
    }
  }
  return best?.region ?? null;
}
