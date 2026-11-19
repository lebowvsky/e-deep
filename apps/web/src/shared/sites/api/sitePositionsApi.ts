// Positions of the sites. The dive log does not carry them: until a `GET /sites` exists, they come
// from `GET /dashboard`, which lists every dived site with its coordinates. Same query and cache
// entry as the dashboard page: one request, invalidated with it.
import type { DashboardResponse } from '@e-deep/shared';
import { toGeoPoint, type GeoPoint } from '@/shared/model/geo';

/** Site id → position, for the placed sites. */
export type SitePositions = ReadonlyMap<string, GeoPoint>;

/** `select` of the dashboard query: the positions of its sites. */
export function toSitePositions({ sites }: DashboardResponse): SitePositions {
  const positions = new Map<string, GeoPoint>();
  for (const site of sites) {
    const position = toGeoPoint(site.latitude, site.longitude);
    if (position) positions.set(site.id, position);
  }
  return positions;
}
