import { Inject, Injectable } from '@nestjs/common';
import { DataSource, In, IsNull, Not, type EntityManager } from 'typeorm';
import { upsertOwnedRow } from '../../common/database/owned-upsert';
import { pullPage } from '../../common/database/sync-pull';
import { IdentifierConflictError, InvalidReferenceError } from '../../common/errors/domain-errors';
import { assertWithinPurgeHorizon, isStaleRestore } from '../../common/sync/sync-rules';
import { SYNC_SETTINGS, type SyncSettings } from '../../common/sync/sync-settings';
import type { PullPage, SyncCursor, SyncWriteResult } from '../../common/sync/sync.types';
import { Buddy } from '../buddies/buddy.entity';
import { CertificationLevel } from '../certification-levels/certification-level.entity';
import { DiveSite } from '../dive-sites/dive-site.entity';
import { Diver } from '../divers/diver.entity';
import { DiveBuddy } from './dive-buddy.entity';
import { DiveEvent } from './dive-event.entity';
import { DiveParticipation } from './dive-participation.entity';
import type { Dive, DiveWrite, ParticipationWithBuddies } from './dive.types';

/**
 * A dive is an aggregate written in one block: event + the diver's participation + its dive team.
 *
 * MVP invariants (enforced here, not in SQL, since sharing will lift them): an event is created by
 * `diverId` and only has `diverId`'s participation; only the creator changes the event, only the
 * diver their participation. `diverId` always comes from the caller, never from a payload.
 */
@Injectable()
export class DivesService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(SYNC_SETTINGS) private readonly settings: SyncSettings,
  ) {}

  /**
   * Synchronised write of a whole dive, in a single transaction: any failure writes nothing.
   *
   * - A stale restore of the event or of the participation (D-12 a) rejects the whole dive.
   * - A tombstoned participation of the same `(event, diver)` is restored under its existing id,
   *   never recreated: `current.participation.id` may then differ from the id sent.
   * - A live dive restores its tombstoned site and buddies (D-12 b).
   * - The dive team is replaced by `buddyIds`.
   *
   * @throws {FullSyncRequiredError} | {IdentifierConflictError} | {InvalidReferenceError}
   */
  async upsertDive(
    diverId: string,
    write: DiveWrite,
    lastPulledAt: Date,
  ): Promise<SyncWriteResult<Dive>> {
    assertWithinPurgeHorizon(lastPulledAt, new Date(), this.settings.purgeHorizonDays);

    return await this.dataSource.transaction(async (manager) => {
      const { event, participation } = write;
      const buddyIds = [...new Set(write.buddyIds)];

      const existingEvent = await manager.findOne(DiveEvent, {
        where: { id: event.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (existingEvent !== null && existingEvent.creatorId !== diverId) {
        throw new IdentifierConflictError();
      }
      const existingParticipation = await findParticipationToWrite(
        manager,
        diverId,
        event.id,
        participation.id,
      );

      const stale =
        (existingEvent !== null && isStaleRestore(existingEvent, event)) ||
        (existingParticipation !== null && isStaleRestore(existingParticipation, participation));
      if (stale) {
        return { status: 'rejected', current: await loadDiveOrFail(manager, diverId, event.id) };
      }

      const certificationLevelId = await resolveParticipationLevel(
        manager,
        diverId,
        participation.certificationLevelId ?? null,
      );
      await assertOwnedReferences(manager, diverId, event.siteId, buddyIds);

      await upsertOwnedRow(manager, DiveEvent, 'creatorId', {
        id: event.id,
        creatorId: diverId,
        siteId: event.siteId,
        startedAt: event.startedAt,
        utcOffsetMinutes: event.utcOffsetMinutes,
        deletedAt: event.deletedAt,
      });
      await upsertOwnedRow(manager, DiveParticipation, 'diverId', {
        id: existingParticipation?.id ?? participation.id,
        diveEventId: event.id,
        diverId,
        certificationLevelId,
        maxDepthM: participation.maxDepthM,
        durationMin: participation.durationMin,
        waterTemperatureC: participation.waterTemperatureC,
        visibilityM: participation.visibilityM,
        gasMix: participation.gasMix,
        hasDecompression: participation.hasDecompression,
        stopsOk: participation.stopsOk,
        notes: participation.notes,
        deletedAt: participation.deletedAt,
      });

      if (event.deletedAt === null && participation.deletedAt === null) {
        await restoreParents(manager, diverId, event.siteId, buddyIds);
      }
      await replaceDiveTeam(
        manager,
        diverId,
        existingParticipation?.id ?? participation.id,
        buddyIds,
      );

      return { status: 'applied', current: await loadDiveOrFail(manager, diverId, event.id) };
    });
  }

  /** MVP deletion of a dive: tombstones the event and the participation together. Idempotent. */
  async deleteDive(diverId: string, eventId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const deletedAt = new Date();
      await manager.update(
        DiveEvent,
        { id: eventId, creatorId: diverId, deletedAt: IsNull() },
        { deletedAt },
      );
      await manager.update(
        DiveParticipation,
        { diveEventId: eventId, diverId, deletedAt: IsNull() },
        { deletedAt },
      );
    });
  }

  /** Sync pull of the events the diver created or takes part in, tombstones included. */
  pullEvents(
    diverId: string,
    cursor: SyncCursor | null,
    limit?: number,
  ): Promise<PullPage<DiveEvent>> {
    const query = this.dataSource.manager.createQueryBuilder(DiveEvent, 'event').where(
      `(event.creatorId = :diverId OR EXISTS (
           SELECT 1 FROM dive_participations p WHERE p.dive_event_id = event.id AND p.diver_id = :diverId
         ))`,
      { diverId },
    );
    return pullPage(query, cursor, limit);
  }

  /** Sync pull of the diver's participations with their dive team, tombstones included. */
  async pullParticipations(
    diverId: string,
    cursor: SyncCursor | null,
    limit?: number,
  ): Promise<PullPage<ParticipationWithBuddies>> {
    const manager = this.dataSource.manager;
    const query = manager
      .createQueryBuilder(DiveParticipation, 'participation')
      .where('participation.diverId = :diverId', { diverId });
    const page = await pullPage(query, cursor, limit);
    const teams = await loadDiveTeams(
      manager,
      page.items.map((item) => item.id),
    );
    return {
      items: page.items.map((participation) => ({
        participation,
        buddyIds: teams.get(participation.id) ?? [],
      })),
      nextCursor: page.nextCursor,
    };
  }
}

/**
 * The participation to write: the diver's existing one for this event (live or tombstoned, it is
 * restored rather than recreated), else the one carrying the id sent.
 */
async function findParticipationToWrite(
  manager: EntityManager,
  diverId: string,
  eventId: string,
  participationId: string,
): Promise<DiveParticipation | null> {
  const byId = await manager.findOne(DiveParticipation, {
    where: { id: participationId },
    lock: { mode: 'pessimistic_write' },
  });
  if (byId !== null && (byId.diverId !== diverId || byId.diveEventId !== eventId)) {
    throw new IdentifierConflictError();
  }
  return (
    byId ??
    manager.findOne(DiveParticipation, {
      where: { diveEventId: eventId, diverId },
      lock: { mode: 'pessimistic_write' },
    })
  );
}

/**
 * Level snapshot (D-09): a level sent by the client is kept as is (only its existence is checked);
 * without one, the diver's current level is copied.
 */
async function resolveParticipationLevel(
  manager: EntityManager,
  diverId: string,
  requested: string | null,
): Promise<string> {
  const diver = await manager.findOneBy(Diver, { id: diverId });
  if (diver === null) {
    throw new InvalidReferenceError();
  }
  if (requested === null) {
    return diver.certificationLevelId;
  }
  if (!(await manager.existsBy(CertificationLevel, { id: requested }))) {
    throw new InvalidReferenceError();
  }
  return requested;
}

/** The site and the buddies must be the diver's own (the composite FKs enforce it as well). */
async function assertOwnedReferences(
  manager: EntityManager,
  diverId: string,
  siteId: string,
  buddyIds: readonly string[],
): Promise<void> {
  const siteOwned = await manager.existsBy(DiveSite, { id: siteId, ownerId: diverId });
  const ownedBuddies =
    buddyIds.length === 0
      ? 0
      : await manager.countBy(Buddy, { ownerId: diverId, id: In([...buddyIds]) });
  if (!siteOwned || ownedBuddies !== buddyIds.length) {
    throw new InvalidReferenceError();
  }
}

/** D-12 b: no live reference to a deleted parent. */
async function restoreParents(
  manager: EntityManager,
  diverId: string,
  siteId: string,
  buddyIds: readonly string[],
): Promise<void> {
  await manager.update(
    DiveSite,
    { id: siteId, ownerId: diverId, deletedAt: Not(IsNull()) },
    { deletedAt: null },
  );
  if (buddyIds.length > 0) {
    await manager.update(
      Buddy,
      { ownerId: diverId, id: In([...buddyIds]), deletedAt: Not(IsNull()) },
      { deletedAt: null },
    );
  }
}

/** Only the lines that change are written, so the trigger only touches a participation when needed. */
async function replaceDiveTeam(
  manager: EntityManager,
  diverId: string,
  participationId: string,
  buddyIds: readonly string[],
): Promise<void> {
  await manager.delete(DiveBuddy, {
    participationId,
    ...(buddyIds.length > 0 ? { buddyId: Not(In([...buddyIds])) } : {}),
  });
  if (buddyIds.length > 0) {
    await manager
      .createQueryBuilder()
      .insert()
      .into(DiveBuddy)
      .values(buddyIds.map((buddyId) => ({ participationId, buddyId, ownerId: diverId })))
      .orIgnore()
      .execute();
  }
}

async function loadDiveOrFail(
  manager: EntityManager,
  diverId: string,
  eventId: string,
): Promise<Dive> {
  const event = await manager.findOneByOrFail(DiveEvent, { id: eventId });
  const participation = await manager.findOneByOrFail(DiveParticipation, {
    diveEventId: eventId,
    diverId,
  });
  const teams = await loadDiveTeams(manager, [participation.id]);
  return { event, participation, buddyIds: teams.get(participation.id) ?? [] };
}

async function loadDiveTeams(
  manager: EntityManager,
  participationIds: readonly string[],
): Promise<Map<string, string[]>> {
  const teams = new Map<string, string[]>();
  if (participationIds.length === 0) {
    return teams;
  }
  const lines = await manager.find(DiveBuddy, {
    where: { participationId: In([...participationIds]) },
    order: { buddyId: 'ASC' },
  });
  for (const line of lines) {
    teams.set(line.participationId, [...(teams.get(line.participationId) ?? []), line.buddyId]);
  }
  return teams;
}
