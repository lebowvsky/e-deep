import type {
  SiteCreateRequest,
  SiteListResponse,
  SiteOrigin,
  SiteResponse,
  SiteType,
  SiteWriteRequest,
} from '@e-deep/shared';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull, type EntityManager } from 'typeorm';
import { lockIdForTransaction } from '../../common/database/advisory-lock';
import { upsertOwnedRow } from '../../common/database/owned-upsert';
import { pullPage } from '../../common/database/sync-pull';
import {
  IdentifierConflictError,
  InvalidReferenceError,
  MergeIntoSelfError,
  SiteInUseError,
} from '../../common/errors/domain-errors';
import { canonicalUuids, isSameUuid, normalizeUuid } from '../../common/ids/uuid';
import { assertWithinPurgeHorizon, isStaleRestore } from '../../common/sync/sync-rules';
import { SYNC_SETTINGS, type SyncSettings } from '../../common/sync/sync-settings';
import type {
  PullPage,
  SyncCursor,
  SyncedWrite,
  SyncWriteResult,
} from '../../common/sync/sync.types';
import { DiveEvent } from '../dives/dive-event.entity';
import { DiveSite } from './dive-site.entity';
import { toSiteResponse } from './site-contract.mapper';
import { completeTargetDetails } from './site-merge';
import { isSameSiteWrite, toDiveSiteWrite } from './site-write.mapper';
import type { DiverId } from '../../common/auth/diver-id';

/**
 * Every field is required, `null` included (D-22): the LWW upsert writes the whole record, so an
 * omitted field would erase the stored value.
 */
export interface DiveSiteWrite extends SyncedWrite {
  readonly id: string;
  readonly name: string;
  readonly locality: string | null;
  /** `null` when not entered: a site may be created by its name alone (D-23). */
  readonly region: string | null;
  /** Sea or area (e.g. `Méditerranée`, D-20). */
  readonly area: string | null;
  /** Both set or both `null` (`ck_dive_sites__position`, D-23). */
  readonly latitude: number | null;
  readonly longitude: number | null;
  // Details of the site (D-27).
  readonly type: SiteType | null;
  /** min ≤ max when both are set (RG-32). */
  readonly depthMinM: number | null;
  readonly depthMaxM: number | null;
  readonly accessNotes: string | null;
  /** Origin, written at creation only and ignored afterwards (RG-34). */
  readonly createdVia: SiteOrigin;
}

/** `created`: 201; `replayed`: the same creation received again, nothing written, 200. */
export interface SiteCreation {
  readonly outcome: 'created' | 'replayed';
  readonly site: SiteResponse;
}

/** Same body for every "not a live site of yours" case (absent, deleted, merged, another diver's). */
export function siteNotFound(): NotFoundException {
  return new NotFoundException('Site not found');
}

/**
 * Dive sites are private to their owner; `ownerId` always comes from the caller (the guard or the
 * synchronisation), never from a payload. Two channels share the same writes: the synchronisation
 * (`upsert`, `remove`, `pull`) and the online API (`/api/sites`, D-33), whose methods answer the
 * contract. Nothing here is logged (locations, GDPR).
 */
@Injectable()
export class DiveSitesService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(SYNC_SETTINGS) private readonly settings: SyncSettings,
  ) {}

  /**
   * Synchronised write (create, update, tombstone or restore).
   *
   * @throws {FullSyncRequiredError} | {IdentifierConflictError} | {SiteInUseError}
   */
  upsert(
    ownerId: string,
    write: DiveSiteWrite,
    lastPulledAt: Date,
  ): Promise<SyncWriteResult<DiveSite>> {
    return this.dataSource.transaction((manager) =>
      this.upsertIn(manager, ownerId, write, lastPulledAt),
    );
  }

  /**
   * `upsert` within the caller's transaction (e.g. a dive written with its new site, D-24). A
   * merged site never comes back (RG-36): writing it is rejected like a stale restore (D-12 a).
   * The origin of an existing site is kept (RG-34).
   */
  async upsertIn(
    manager: EntityManager,
    ownerId: string,
    write: DiveSiteWrite,
    lastPulledAt: Date,
  ): Promise<SyncWriteResult<DiveSite>> {
    assertWithinPurgeHorizon(lastPulledAt, new Date(), this.settings.purgeHorizonDays);

    const existing = await manager.findOne(DiveSite, {
      where: { id: write.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (existing !== null && existing.ownerId !== ownerId) {
      throw new IdentifierConflictError();
    }
    if (existing !== null && (existing.mergedIntoId !== null || isStaleRestore(existing, write))) {
      return { status: 'rejected', current: existing };
    }
    if (write.deletedAt !== null && existing !== null && existing.deletedAt === null) {
      await assertSiteUnused(manager, ownerId, write.id);
    }

    await upsertOwnedRow(manager, DiveSite, 'ownerId', {
      id: write.id,
      ownerId,
      name: write.name,
      locality: write.locality,
      region: write.region,
      area: write.area,
      latitude: write.latitude,
      longitude: write.longitude,
      type: write.type,
      depthMinM: write.depthMinM,
      depthMaxM: write.depthMaxM,
      accessNotes: write.accessNotes,
      createdVia: existing?.createdVia ?? write.createdVia,
      deletedAt: write.deletedAt,
    });
    return {
      status: 'applied',
      current: await manager.findOneByOrFail(DiveSite, { id: write.id }),
    };
  }

  /**
   * Tombstones a live site of the owner. Idempotent: an unknown, deleted or foreign id is ignored.
   *
   * @returns whether a live site was deleted.
   * @throws {SiteInUseError} when a live dive event still uses the site (RG-37).
   */
  remove(ownerId: DiverId, siteId: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const site = await findLiveSiteForWrite(manager, ownerId, siteId);
      if (site === null) {
        return false;
      }
      await assertSiteUnused(manager, ownerId, siteId);
      await manager.update(DiveSite, { id: siteId, ownerId }, { deletedAt: new Date() });
      return true;
    });
  }

  /** Sync pull of the owner's sites, tombstones (and their `mergedIntoId`) included. */
  pull(ownerId: string, cursor: SyncCursor | null, limit?: number): Promise<PullPage<DiveSite>> {
    const query = this.dataSource.manager
      .createQueryBuilder(DiveSite, 'site')
      .where('site.ownerId = :ownerId', { ownerId });
    return pullPage(query, cursor, limit);
  }

  /** `GET /api/sites`: the live sites of the owner, by name then id. */
  async list(ownerId: DiverId): Promise<SiteListResponse> {
    const sites = await this.dataSource.manager.find(DiveSite, {
      where: { ownerId, deletedAt: IsNull() },
      order: { name: 'ASC', id: 'ASC' },
    });
    return { sites: sites.map(toSiteResponse) };
  }

  /**
   * `GET /api/sites/:id`.
   *
   * @throws {NotFoundException} when the site is absent, deleted (merged included) or another
   *   diver's: indistinguishable on purpose (ARCHITECTURE §9).
   */
  async findOne(ownerId: DiverId, siteId: string): Promise<SiteResponse> {
    const site = await this.dataSource.manager.findOneBy(DiveSite, {
      id: siteId,
      ownerId,
      deletedAt: IsNull(),
    });
    if (site === null) {
      throw siteNotFound();
    }
    return toSiteResponse(site);
  }

  /**
   * `POST /api/sites`: creates a site under its client id (D22). Receiving the same creation again
   * (same id, live, same content) writes nothing and answers `replayed`.
   *
   * @throws {IdentifierConflictError} when the id is already taken: different content, a deleted
   *   site or another diver's, indistinguishable on purpose (D-24).
   */
  create(ownerId: DiverId, request: SiteCreateRequest): Promise<SiteCreation> {
    return this.dataSource.transaction(async (manager): Promise<SiteCreation> => {
      // Two creations of the same new id: the second waits, then sees the first.
      await lockIdForTransaction(manager, request.id);
      const write = toDiveSiteWrite(request, request.createdVia);
      const existing = await manager.findOneBy(DiveSite, { id: request.id });
      if (existing !== null) {
        const replayed =
          existing.ownerId === ownerId &&
          existing.deletedAt === null &&
          isSameSiteWrite(write, existing);
        if (!replayed) {
          throw new IdentifierConflictError();
        }
        return { outcome: 'replayed', site: toSiteResponse(existing) };
      }
      const { current } = await this.upsertIn(manager, ownerId, write, new Date());
      return { outcome: 'created', site: toSiteResponse(current) };
    });
  }

  /**
   * `PUT /api/sites/:id`: replaces a live site of the owner as a whole, last write wins (D-25).
   * Keeps its origin (RG-34). Neither creates nor restores a site.
   *
   * @throws {NotFoundException} when the site is absent, deleted or another diver's.
   */
  replace(ownerId: DiverId, request: SiteWriteRequest): Promise<SiteResponse> {
    return this.dataSource.transaction(async (manager) => {
      const site = await findLiveSiteForWrite(manager, ownerId, request.id);
      if (site === null) {
        throw siteNotFound();
      }
      const { current } = await this.upsertIn(
        manager,
        ownerId,
        toDiveSiteWrite(request, site.createdVia),
        new Date(),
      );
      return toSiteResponse(current);
    });
  }

  /**
   * `POST /api/sites/:id/merge` (D-29, RG-35), in one transaction: every dive event of the source,
   * tombstones included, moves to the target; the empty fields of the target are completed; the
   * sites merged into the source now point to the target (one hop, RG-36); the source becomes a
   * tombstone that keeps its target. Irreversible.
   *
   * @returns the completed target.
   * @throws {NotFoundException} when the source is not a live site of the owner.
   * @throws {MergeIntoSelfError} when the target is the source.
   * @throws {InvalidReferenceError} when the target is not a live site of the owner.
   */
  merge(ownerId: DiverId, sourceId: string, targetId: string): Promise<SiteResponse> {
    return this.dataSource.transaction(async (manager) => {
      const locked = await lockSitesInIdOrder(manager, ownerId, [sourceId, targetId]);
      const source = locked.get(normalizeUuid(sourceId));
      if (source === undefined || source.deletedAt !== null) {
        throw siteNotFound();
      }
      if (isSameUuid(sourceId, targetId)) {
        throw new MergeIntoSelfError();
      }
      const target = locked.get(normalizeUuid(targetId));
      if (target === undefined || target.deletedAt !== null) {
        throw new InvalidReferenceError();
      }

      // The trigger advances `updated_at` of the events: the other devices pull them again.
      await manager.update(
        DiveEvent,
        { creatorId: ownerId, siteId: source.id },
        { siteId: target.id },
      );
      await manager.update(
        DiveSite,
        { id: target.id, ownerId },
        completeTargetDetails(target, source),
      );
      await manager.update(
        DiveSite,
        { ownerId, mergedIntoId: source.id },
        { mergedIntoId: target.id },
      );
      await manager.update(
        DiveSite,
        { id: source.id, ownerId },
        { deletedAt: new Date(), mergedIntoId: target.id },
      );
      return toSiteResponse(await manager.findOneByOrFail(DiveSite, { id: target.id }));
    });
  }
}

/**
 * The site a dive written on `siteId` must reference (RG-36): a merged site is replaced by its
 * target. Read under a share lock, so that a merge running meanwhile either waits for the dive or
 * is seen once committed (and its target followed). Returns `siteId` unchanged for an unknown or
 * foreign id: the ownership check reports it.
 */
export async function resolveMergedSiteIn(
  manager: EntityManager,
  ownerId: string,
  siteId: string,
): Promise<string> {
  let resolved = siteId;
  // Terminates: a merge target is live when merged, so the chain has no cycle.
  for (;;) {
    const site = await manager.findOne(DiveSite, {
      select: { id: true, mergedIntoId: true },
      where: { id: resolved, ownerId },
      lock: { mode: 'pessimistic_read' },
    });
    if (site === null || site.mergedIntoId === null) {
      return resolved;
    }
    resolved = site.mergedIntoId;
  }
}

async function findLiveSiteForWrite(
  manager: EntityManager,
  ownerId: string,
  siteId: string,
): Promise<DiveSite | null> {
  return manager.findOne(DiveSite, {
    where: { id: siteId, ownerId, deletedAt: IsNull() },
    lock: { mode: 'pessimistic_write' },
  });
}

/**
 * The owner's sites among `ids` (tombstones included), locked for writing in id order: two merges
 * crossing the same sites cannot deadlock. Keyed by normalised id.
 */
async function lockSitesInIdOrder(
  manager: EntityManager,
  ownerId: string,
  ids: readonly string[],
): Promise<Map<string, DiveSite>> {
  const locked = new Map<string, DiveSite>();
  for (const id of canonicalUuids(ids)) {
    const site = await manager.findOne(DiveSite, {
      where: { id, ownerId },
      lock: { mode: 'pessimistic_write' },
    });
    if (site !== null) {
      locked.set(id, site);
    }
  }
  return locked;
}

/** RG-37: tombstoned events do not count, the purge waits for theirs (D-12 c). */
async function assertSiteUnused(
  manager: EntityManager,
  ownerId: string,
  siteId: string,
): Promise<void> {
  const used = await manager.exists(DiveEvent, {
    where: { creatorId: ownerId, siteId, deletedAt: IsNull() },
  });
  if (used) {
    throw new SiteInUseError();
  }
}
