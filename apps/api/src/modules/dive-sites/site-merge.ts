import type { DiveSite } from './dive-site.entity';

/** The fields of a merge target that the source may complete (RG-35). */
export type SiteDetails = Pick<
  DiveSite,
  | 'locality'
  | 'region'
  | 'area'
  | 'type'
  | 'accessNotes'
  | 'latitude'
  | 'longitude'
  | 'depthMinM'
  | 'depthMaxM'
>;

/**
 * The details of the target once completed by the source (D-29): every empty field of the target
 * takes the source's value; the position is taken as a pair (D-23); the depths field by field,
 * unless the result would break min ≤ max, in which case the target keeps its own. The name and the
 * origin of the target are never taken (not part of `SiteDetails`).
 */
export function completeTargetDetails(target: SiteDetails, source: SiteDetails): SiteDetails {
  return {
    locality: target.locality ?? source.locality,
    region: target.region ?? source.region,
    area: target.area ?? source.area,
    type: target.type ?? source.type,
    accessNotes: target.accessNotes ?? source.accessNotes,
    ...completePosition(target, source),
    ...completeDepths(target, source),
  };
}

function completePosition(
  target: SiteDetails,
  source: SiteDetails,
): Pick<SiteDetails, 'latitude' | 'longitude'> {
  const { latitude, longitude } = target.latitude === null ? source : target;
  return { latitude, longitude };
}

function completeDepths(
  target: SiteDetails,
  source: SiteDetails,
): Pick<SiteDetails, 'depthMinM' | 'depthMaxM'> {
  const depthMinM = target.depthMinM ?? source.depthMinM;
  const depthMaxM = target.depthMaxM ?? source.depthMaxM;
  const ordered = depthMinM === null || depthMaxM === null || depthMinM <= depthMaxM;
  return ordered
    ? { depthMinM, depthMaxM }
    : { depthMinM: target.depthMinM, depthMaxM: target.depthMaxM };
}
