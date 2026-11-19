// The sites as the API stores them, for the fakes of the tests (the repository in memory, the fake
// server of the round trips): the rules of the API on its records, in one place.
// Tests only: never imported by the application code.
import type { DiveSiteRef, SiteResponse } from '@e-deep/shared';
import type { Site } from '@/shared/model/site';

/** The record of `site`, as `GET /api/sites` would serve it. */
export function toSiteRecord(site: Site): SiteResponse {
  return {
    id: site.id,
    name: site.name,
    ...site.storedPlace,
    latitude: site.position?.latitude ?? null,
    longitude: site.position?.longitude ?? null,
    type: site.type,
    depthMinM: site.depthMinM,
    depthMaxM: site.depthMaxM,
    accessNotes: site.accessNotes,
    createdVia: site.createdVia,
    createdAt: site.createdAt,
    updatedAt: site.updatedAt,
  };
}

/** The site of a dive in the log: the API joins it, so it follows a rename and a merge. */
export function toDiveSiteRef({ id, name, locality, region }: SiteResponse): DiveSiteRef {
  return { id, name, locality, region };
}

/**
 * The merge of `source` into `target` (D-29): the empty fields of the target take those of the
 * source, the position as a pair, the depths field by field unless min ≤ max would break (the
 * target keeps its own then); name and origin of the target are kept.
 */
export function completeSiteRecord(
  target: SiteResponse,
  source: SiteResponse,
  updatedAt: string,
): SiteResponse {
  const position =
    target.latitude === null
      ? { latitude: source.latitude, longitude: source.longitude }
      : { latitude: target.latitude, longitude: target.longitude };
  const depthMinM = target.depthMinM ?? source.depthMinM;
  const depthMaxM = target.depthMaxM ?? source.depthMaxM;
  const depths =
    depthMinM !== null && depthMaxM !== null && depthMinM > depthMaxM
      ? { depthMinM: target.depthMinM, depthMaxM: target.depthMaxM }
      : { depthMinM, depthMaxM };
  return {
    ...target,
    locality: target.locality ?? source.locality,
    region: target.region ?? source.region,
    area: target.area ?? source.area,
    ...position,
    type: target.type ?? source.type,
    ...depths,
    accessNotes: target.accessNotes ?? source.accessNotes,
    updatedAt,
  };
}
