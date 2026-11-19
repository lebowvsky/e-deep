import type { SiteResponse } from '@e-deep/shared';
import type { DiveSite } from './dive-site.entity';

/**
 * A live site as the front reads it. Neither `deletedAt` nor `mergedIntoId`: only live sites are
 * served (a merged site answers 404, D-30).
 */
export function toSiteResponse(site: DiveSite): SiteResponse {
  return {
    id: site.id,
    name: site.name,
    locality: site.locality,
    region: site.region,
    area: site.area,
    latitude: site.latitude,
    longitude: site.longitude,
    type: site.type,
    depthMinM: site.depthMinM,
    depthMaxM: site.depthMaxM,
    accessNotes: site.accessNotes,
    createdVia: site.createdVia,
    createdAt: site.createdAt.toISOString(),
    updatedAt: site.updatedAt.toISOString(),
  };
}
