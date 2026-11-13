import { Inject, Injectable } from '@nestjs/common';
import { DataSource, IsNull, type EntityManager } from 'typeorm';
import { upsertOwnedRow } from '../../common/database/owned-upsert';
import { pullPage } from '../../common/database/sync-pull';
import { IdentifierConflictError, SiteInUseError } from '../../common/errors/domain-errors';
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

export interface DiveSiteWrite extends SyncedWrite {
  readonly id: string;
  readonly name: string;
  /** Omitted → `null`. */
  readonly locality?: string | null;
  readonly region: string;
  readonly latitude: number;
  readonly longitude: number;
}

/** Dive sites are private to their owner; `ownerId` always comes from the caller, never a payload. */
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
  async upsert(
    ownerId: string,
    write: DiveSiteWrite,
    lastPulledAt: Date,
  ): Promise<SyncWriteResult<DiveSite>> {
    assertWithinPurgeHorizon(lastPulledAt, new Date(), this.settings.purgeHorizonDays);

    return await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(DiveSite, {
        where: { id: write.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing !== null && existing.ownerId !== ownerId) {
        throw new IdentifierConflictError();
      }
      if (existing !== null && isStaleRestore(existing, write)) {
        return { status: 'rejected', current: existing };
      }
      if (write.deletedAt !== null && existing !== null && existing.deletedAt === null) {
        await assertSiteUnused(manager, ownerId, write.id);
      }

      await upsertOwnedRow(manager, DiveSite, 'ownerId', {
        id: write.id,
        ownerId,
        name: write.name,
        locality: write.locality ?? null,
        region: write.region,
        latitude: write.latitude,
        longitude: write.longitude,
        deletedAt: write.deletedAt,
      });
      return {
        status: 'applied',
        current: await manager.findOneByOrFail(DiveSite, { id: write.id }),
      };
    });
  }

  /**
   * Tombstones a site. Idempotent; an unknown or foreign id is ignored.
   *
   * @throws {SiteInUseError} when a live dive event still uses the site.
   */
  async remove(ownerId: string, siteId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const site = await manager.findOne(DiveSite, {
        where: { id: siteId, ownerId, deletedAt: IsNull() },
        lock: { mode: 'pessimistic_write' },
      });
      if (site === null) {
        return;
      }
      await assertSiteUnused(manager, ownerId, siteId);
      await manager.update(DiveSite, { id: siteId, ownerId }, { deletedAt: new Date() });
    });
  }

  /** Sync pull of the owner's sites, tombstones included. */
  pull(ownerId: string, cursor: SyncCursor | null, limit?: number): Promise<PullPage<DiveSite>> {
    const query = this.dataSource.manager
      .createQueryBuilder(DiveSite, 'site')
      .where('site.ownerId = :ownerId', { ownerId });
    return pullPage(query, cursor, limit);
  }
}

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
