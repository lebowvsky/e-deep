import type { SiteOrigin, SiteWriteRequest } from '@e-deep/shared';
import type { SyncedWrite } from '../../common/sync/sync.types';
import type { DiveSite } from './dive-site.entity';
import type { DiveSiteWrite } from './dive-sites.service';

/**
 * A validated request as the synchronised write of a live site (the online channel neither
 * deletes nor restores through `POST` / `PUT`). `createdVia` only counts at creation (RG-34).
 */
export function toDiveSiteWrite(request: SiteWriteRequest, createdVia: SiteOrigin): DiveSiteWrite {
  return {
    id: request.id,
    name: request.name,
    locality: request.locality,
    region: request.region,
    area: request.area,
    latitude: request.latitude,
    longitude: request.longitude,
    type: request.type,
    depthMinM: request.depthMinM,
    depthMaxM: request.depthMaxM,
    accessNotes: request.accessNotes,
    createdVia,
    baseUpdatedAt: null,
    deletedAt: null,
  };
}

/** Fields compared by `isSameSiteWrite`: all but the id (the lookup key) and the protocol fields. */
type ComparedField = Exclude<keyof DiveSiteWrite, 'id' | keyof SyncedWrite>;

/** Lists every field once: a field added to the write type and forgotten here fails the typecheck. */
const COMPARED_FIELDS = Object.keys({
  name: true,
  locality: true,
  region: true,
  area: true,
  latitude: true,
  longitude: true,
  type: true,
  depthMinM: true,
  depthMaxM: true,
  accessNotes: true,
  createdVia: true,
} satisfies Record<ComparedField, true>) as ComparedField[];

/**
 * Whether `write` would leave the stored site unchanged, so that a replayed creation (retry after a
 * timeout) succeeds without writing. Liveness and owner are the caller's concern.
 *
 * Numbers compare by value: `numeric` columns are read back as numbers, and the DTO refuses more
 * decimals than the column keeps.
 */
export function isSameSiteWrite(write: DiveSiteWrite, current: DiveSite): boolean {
  return COMPARED_FIELDS.every((field) => write[field] === current[field]);
}
