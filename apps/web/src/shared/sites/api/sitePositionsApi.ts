// Positions of the sites. The dive log does not carry them: until a `GET /sites` exists, they come
// from `GET /dashboard`, which lists every dived site with its coordinates.
import type { DashboardSite } from '@e-deep/shared';
import type { ApiClient, RequestOptions } from '@/shared/lib/apiClient';
import {
  isArrayOf,
  isNullable,
  isNumber,
  isPositionPair,
  isRecord,
  isString,
} from '@/shared/lib/guards';
import { toGeoPoint, type GeoPoint } from '@/shared/model/geo';

/** A site of `GET /dashboard` (also the dashboard's own guard). */
export function isDashboardSite(value: unknown): value is DashboardSite {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isNullable(isString)(value.region) &&
    isPositionPair(value.latitude, value.longitude) &&
    isNumber(value.diveCount) &&
    isNumber(value.maxDepthM)
  );
}

/** Only the part of the dashboard the sites read: the rest of the body is not checked here. */
function hasDashboardSites(value: unknown): value is { sites: DashboardSite[] } {
  return isRecord(value) && isArrayOf(isDashboardSite)(value.sites);
}

/** Site id → position, for the placed sites. */
export type SitePositions = ReadonlyMap<string, GeoPoint>;

export async function fetchSitePositions(
  client: ApiClient,
  options?: RequestOptions,
): Promise<SitePositions> {
  const { sites } = await client.get('dashboard', hasDashboardSites, options);
  const positions = new Map<string, GeoPoint>();
  for (const site of sites) {
    const position = toGeoPoint(site.latitude, site.longitude);
    if (position) positions.set(site.id, position);
  }
  return positions;
}
