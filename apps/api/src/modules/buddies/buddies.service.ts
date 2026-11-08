import { Inject, Injectable } from '@nestjs/common';
import { DataSource, IsNull, type EntityManager } from 'typeorm';
import { upsertOwnedRow } from '../../common/database/owned-upsert';
import { isUniqueViolation } from '../../common/database/postgres-errors';
import { pullPage } from '../../common/database/sync-pull';
import {
  BuddyLinkConflictError,
  IdentifierConflictError,
  InvalidReferenceError,
} from '../../common/errors/domain-errors';
import { assertWithinPurgeHorizon, isStaleRestore } from '../../common/sync/sync-rules';
import { SYNC_SETTINGS, type SyncSettings } from '../../common/sync/sync-settings';
import type {
  PullPage,
  SyncCursor,
  SyncedWrite,
  SyncWriteResult,
} from '../../common/sync/sync.types';
import { Diver } from '../divers/diver.entity';
import { DiveBuddy } from '../dives/dive-buddy.entity';
import { Buddy } from './buddy.entity';

export interface BuddyWrite extends SyncedWrite {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly linkedDiverId: string | null;
}

const LINK_UNIQUE_INDEX = 'uq_buddies__owner_id_linked_diver_id';

/**
 * Buddies are private contacts. Linking one to an E-Deep account shares nothing (H-05).
 * `ownerId` always comes from the caller, never from a payload.
 */
@Injectable()
export class BuddiesService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(SYNC_SETTINGS) private readonly settings: SyncSettings,
  ) {}

  /**
   * Synchronised write (create, update, tombstone or restore). A tombstone also removes the buddy
   * from every dive team.
   *
   * @throws {FullSyncRequiredError} | {IdentifierConflictError} | {InvalidReferenceError} |
   *   {BuddyLinkConflictError}
   */
  async upsert(
    ownerId: string,
    write: BuddyWrite,
    lastPulledAt: Date,
  ): Promise<SyncWriteResult<Buddy>> {
    assertWithinPurgeHorizon(lastPulledAt, new Date(), this.settings.purgeHorizonDays);

    return await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Buddy, {
        where: { id: write.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (existing !== null && existing.ownerId !== ownerId) {
        throw new IdentifierConflictError();
      }
      if (existing !== null && isStaleRestore(existing, write)) {
        return { status: 'rejected', current: existing };
      }
      await assertLinkableDiver(manager, ownerId, write.linkedDiverId);

      try {
        await upsertOwnedRow(manager, Buddy, 'ownerId', {
          id: write.id,
          ownerId,
          firstName: write.firstName,
          lastName: write.lastName,
          linkedDiverId: write.linkedDiverId,
          deletedAt: write.deletedAt,
        });
      } catch (error) {
        throw isUniqueViolation(error, LINK_UNIQUE_INDEX) ? new BuddyLinkConflictError() : error;
      }
      if (write.deletedAt !== null) {
        await removeFromDiveTeams(manager, ownerId, write.id);
      }
      return { status: 'applied', current: await manager.findOneByOrFail(Buddy, { id: write.id }) };
    });
  }

  /** Tombstones a buddy and removes it from every dive team. Idempotent. */
  async remove(ownerId: string, buddyId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        Buddy,
        { id: buddyId, ownerId, deletedAt: IsNull() },
        { deletedAt: new Date() },
      );
      await removeFromDiveTeams(manager, ownerId, buddyId);
    });
  }

  /** Sync pull of the owner's buddies, tombstones included. */
  pull(ownerId: string, cursor: SyncCursor | null, limit?: number): Promise<PullPage<Buddy>> {
    const query = this.dataSource.manager
      .createQueryBuilder(Buddy, 'buddy')
      .where('buddy.ownerId = :ownerId', { ownerId });
    return pullPage(query, cursor, limit);
  }
}

/** The linked account must exist and not be the owner (also enforced by `ck_buddies__not_self`). */
async function assertLinkableDiver(
  manager: EntityManager,
  ownerId: string,
  linkedDiverId: string | null,
): Promise<void> {
  if (linkedDiverId === null) {
    return;
  }
  if (linkedDiverId === ownerId || !(await manager.existsBy(Diver, { id: linkedDiverId }))) {
    throw new InvalidReferenceError();
  }
}

/** Each removed line touches its participation (trigger), so it comes back in the sync pull. */
async function removeFromDiveTeams(
  manager: EntityManager,
  ownerId: string,
  buddyId: string,
): Promise<void> {
  await manager.delete(DiveBuddy, { ownerId, buddyId });
}
