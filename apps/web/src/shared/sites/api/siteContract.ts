// The sites contract (`/api/sites`, D31) at the boundary: the guards of the answers and the
// conversion `SiteResponse ↔ Site`, label of the place included (D-32).
import type { SiteListResponse, SiteResponse, SiteWriteRequest } from '@e-deep/shared';
import { placeLabel } from '@/shared/lib/format';
import {
  isArrayOf,
  isDateString,
  isNullable,
  isNullableOneOf,
  isNumber,
  isOneOf,
  isPositionPair,
  isRecord,
  isString,
} from '@/shared/lib/guards';
import { toGeoPoint } from '@/shared/model/geo';
import {
  SITE_ORIGINS,
  SITE_TYPES,
  type Site,
  type SiteDraft,
  type StoredPlace,
} from '@/shared/model/site';
import { deriveZone } from '../lib/zone';

export function isSiteResponse(value: unknown): value is SiteResponse {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    isNullable(isString)(value.locality) &&
    isNullable(isString)(value.region) &&
    isNullable(isString)(value.area) &&
    isPositionPair(value.latitude, value.longitude) &&
    isNullableOneOf(SITE_TYPES)(value.type) &&
    isNullable(isNumber)(value.depthMinM) &&
    isNullable(isNumber)(value.depthMaxM) &&
    isNullable(isString)(value.accessNotes) &&
    isOneOf(value.createdVia, SITE_ORIGINS) &&
    isDateString(value.createdAt) &&
    isDateString(value.updatedAt)
  );
}

export function isSiteListResponse(value: unknown): value is SiteListResponse {
  return isRecord(value) && isArrayOf(isSiteResponse)(value.sites);
}

/** A site as the screens know it: one label for the place, the zone derived. */
export function toSite(response: SiteResponse): Site {
  const position = toGeoPoint(response.latitude, response.longitude);
  const region = placeLabel(response.locality, response.region);
  return {
    id: response.id,
    name: response.name,
    region,
    zone: deriveZone(position, region),
    type: response.type,
    depthMinM: response.depthMinM,
    depthMaxM: response.depthMaxM,
    position,
    accessNotes: response.accessNotes,
    createdVia: response.createdVia,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    storedPlace: { locality: response.locality, region: response.region, area: response.area },
  };
}

const PLACE_SEPARATOR = '·';

const enteredOrNull = (text: string): string | null => {
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * A label typed by the diver, cut at its **first** « · » (D-32): « Calvi · Haute-Corse » →
 * `Calvi` + `Haute-Corse`; without separator, it is the region alone.
 */
export function splitPlaceLabel(label: string | null): Pick<StoredPlace, 'locality' | 'region'> {
  if (label === null) return { locality: null, region: null };
  const separator = label.indexOf(PLACE_SEPARATOR);
  if (separator === -1) return { locality: null, region: enteredOrNull(label) };
  return {
    locality: enteredOrNull(label.slice(0, separator)),
    region: enteredOrNull(label.slice(separator + PLACE_SEPARATOR.length)),
  };
}

/**
 * The place to write for the label `label`: the stored values of `site` while its label is
 * unchanged (nothing lost on a full `PUT`), else the label cut in two. `area`, never shown, is
 * always sent back as stored.
 */
function placeToWrite(label: string | null, site: Site | null): StoredPlace {
  if (site !== null && label === site.region) return site.storedPlace;
  return { ...splitPlaceLabel(label), area: site?.storedPlace.area ?? null };
}

/**
 * Body of `PUT /api/sites/:id` (and of the POST, with `createdVia`): `draft` written over `site`,
 * `null` for a new one.
 */
export function toSiteWriteRequest(
  id: string,
  draft: SiteDraft,
  site: Site | null,
): SiteWriteRequest {
  return {
    id,
    name: draft.name,
    ...placeToWrite(draft.region, site),
    latitude: draft.position?.latitude ?? null,
    longitude: draft.position?.longitude ?? null,
    type: draft.type,
    depthMinM: draft.depthMinM,
    depthMaxM: draft.depthMaxM,
    accessNotes: draft.accessNotes,
  };
}
