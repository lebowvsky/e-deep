import { Inject, Injectable } from '@nestjs/common';
import { DataSource, In, IsNull, Not, type EntityManager } from 'typeorm';
import { upsertOwnedRow } from '../../common/database/owned-upsert';
import { isUniqueViolation } from '../../common/database/postgres-errors';
import { pullPage } from '../../common/database/sync-pull';
import {
  BuddyLinkConflictError,
  DuplicateObservationError,
  IdentifierConflictError,
  InvalidReferenceError,
  TooManyObservationsError,
} from '../../common/errors/domain-errors';
import { canonicalUuids } from '../../common/ids/uuid';
import { assertWithinPurgeHorizon, isStaleRestore } from '../../common/sync/sync-rules';
import { SYNC_SETTINGS, type SyncSettings } from '../../common/sync/sync-settings';
import type { PullPage, SyncCursor, SyncWriteResult } from '../../common/sync/sync.types';
import { Buddy, BUDDY_LINK_UNIQUE_INDEX } from '../buddies/buddy.entity';
import { CertificationLevel } from '../certification-levels/certification-level.entity';
import { DiveSite } from '../dive-sites/dive-site.entity';
import { resolveMergedSiteIn } from '../dive-sites/dive-sites.service';
import { Diver } from '../divers/diver.entity';
import { DiveBuddy } from './dive-buddy.entity';
import { DiveEvent } from './dive-event.entity';
import { DiveObservation } from './dive-observation.entity';
import { DiveParticipation } from './dive-participation.entity';
import type {
  Dive,
  DiveLookup,
  DiveObservationValue,
  DiveObservationWrite,
  DiveWrite,
  ParticipationWithBuddies,
} from './dive.types';

/** Cap of observations per participation (RG-27), also guaranteed by `ck_dive_observations__position`. */
export const MAX_OBSERVATIONS = 50;

/** Cap of members of a dive team, checked by the write DTO (`too-many`). */
export const MAX_DIVE_BUDDIES = 50;

/**
 * A dive is an aggregate written in one block: event + the diver's participation + its dive team +
 * its observations.
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
   * - A site merged into another is replaced by its target (RG-36), before anything else.
   * - A live dive restores its tombstoned site and buddies (D-12 b), unless a restored buddy's
   *   linked account is already linked to another live contact (`BuddyLinkConflictError`).
   * - The dive team is replaced by `buddyIds` (a set: case and order do not matter), the
   *   observations by `observations` (position = index, labels trimmed).
   *
   * @throws {FullSyncRequiredError} | {IdentifierConflictError} | {InvalidReferenceError} |
   *   {BuddyLinkConflictError} | {DuplicateObservationError} | {TooManyObservationsError}
   */
  upsertDive(
    diverId: string,
    write: DiveWrite,
    lastPulledAt: Date,
  ): Promise<SyncWriteResult<Dive>> {
    return this.dataSource.transaction((manager) =>
      this.upsertDiveIn(manager, diverId, write, lastPulledAt),
    );
  }

  /** `upsertDive` within the caller's transaction (e.g. with a new site and new buddies, D-24). */
  async upsertDiveIn(
    manager: EntityManager,
    diverId: string,
    write: DiveWrite,
    lastPulledAt: Date,
  ): Promise<SyncWriteResult<Dive>> {
    assertWithinPurgeHorizon(lastPulledAt, new Date(), this.settings.purgeHorizonDays);
    const observations = normalizeObservations(write.observations);
    const { participation } = write;
    const event = {
      ...write.event,
      siteId: await resolveMergedSiteIn(manager, diverId, write.event.siteId),
    };
    // Canonical order: rows are restored and team lines inserted in the same order by every write.
    const buddyIds = canonicalUuids(write.buddyIds);

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
      entryType: event.entryType,
      timeOfDay: event.timeOfDay,
      weather: event.weather,
      airTemperatureC: event.airTemperatureC,
      seaState: event.seaState,
      currentStrength: event.currentStrength,
      diveCenter: event.diveCenter,
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
      surfaceWaterTemperatureC: participation.surfaceWaterTemperatureC,
      safetyStopDurationMin: participation.safetyStopDurationMin,
      safetyStopDepthM: participation.safetyStopDepthM,
      isRepetitive: participation.isRepetitive,
      o2Percent: participation.o2Percent,
      tankVolumeL: participation.tankVolumeL,
      tankMaterial: participation.tankMaterial,
      startPressureBar: participation.startPressureBar,
      endPressureBar: participation.endPressureBar,
      suitType: participation.suitType,
      suitThicknessMm: participation.suitThicknessMm,
      weightKg: participation.weightKg,
      deletedAt: participation.deletedAt,
    });

    if (event.deletedAt === null && participation.deletedAt === null) {
      await restoreParents(manager, diverId, event.siteId, buddyIds);
    }
    const participationId = existingParticipation?.id ?? participation.id;
    await replaceDiveTeam(manager, diverId, participationId, buddyIds);
    await replaceObservations(manager, participationId, observations);

    return { status: 'applied', current: await loadDiveOrFail(manager, diverId, event.id) };
  }

  /**
   * The dive behind an event id, locked for writing within the caller's transaction, tombstones
   * included: `absent` (unknown id), `foreign` (the event is not the diver's) or `own`.
   */
  async findDiveForWriteIn(
    manager: EntityManager,
    diverId: string,
    eventId: string,
  ): Promise<DiveLookup> {
    const event = await manager.findOne(DiveEvent, {
      where: { id: eventId },
      lock: { mode: 'pessimistic_write' },
    });
    if (event === null) {
      return { status: 'absent' };
    }
    const participation =
      event.creatorId === diverId
        ? await manager.findOne(DiveParticipation, {
            where: { diveEventId: eventId, diverId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;
    if (participation === null) {
      return { status: 'foreign' };
    }
    return { status: 'own', dive: await withTeamAndObservations(manager, event, participation) };
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

  /**
   * Sync pull of the diver's participations with their dive team and observations, tombstones
   * included.
   */
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
    const participationIds = page.items.map((item) => item.id);
    const teams = await loadDiveTeams(manager, participationIds);
    const observations = await loadObservations(manager, participationIds);
    return {
      items: page.items.map((participation) => ({
        participation,
        buddyIds: teams.get(participation.id) ?? [],
        observations: observations.get(participation.id) ?? [],
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

/**
 * D-12 b: no live reference to a deleted parent.
 *
 * @throws {BuddyLinkConflictError} when a restored buddy's linked account is already linked to
 *   another live contact. PostgreSQL has aborted the transaction by then: it can only be rolled back.
 */
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
    try {
      await manager.update(
        Buddy,
        { ownerId: diverId, id: In([...buddyIds]), deletedAt: Not(IsNull()) },
        { deletedAt: null },
      );
    } catch (error) {
      throw isUniqueViolation(error, BUDDY_LINK_UNIQUE_INDEX)
        ? new BuddyLinkConflictError()
        : error;
    }
  }
}

/**
 * Only the lines that change are written, so the trigger only touches a participation when needed.
 * `buddyIds` comes in canonical order (`canonicalUuids`), so are the lines inserted.
 */
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

/**
 * Validates and normalises the observations before anything is written (D-19): labels trimmed, at
 * most `MAX_OBSERVATIONS`, no label twice (the `UNIQUE` would otherwise end in a driver error).
 * Case is kept as entered.
 *
 * @throws {TooManyObservationsError} | {DuplicateObservationError}
 */
export function normalizeObservations(
  observations: readonly DiveObservationWrite[],
): DiveObservationValue[] {
  if (observations.length > MAX_OBSERVATIONS) {
    throw new TooManyObservationsError();
  }
  const normalized = observations.map(({ label, count }) => ({ label: label.trim(), count }));
  if (new Set(normalized.map(({ label }) => label)).size !== normalized.length) {
    throw new DuplicateObservationError();
  }
  return normalized;
}

/**
 * Replaces the observations of the participation as a whole, position = index. Nothing is written
 * when they are unchanged, so the trigger does not touch the participation needlessly.
 */
async function replaceObservations(
  manager: EntityManager,
  participationId: string,
  observations: readonly DiveObservationValue[],
): Promise<void> {
  const current = (await loadObservations(manager, [participationId])).get(participationId) ?? [];
  const unchanged =
    current.length === observations.length &&
    current.every((stored, index) => {
      const next = observations[index];
      return next !== undefined && stored.label === next.label && stored.count === next.count;
    });
  if (unchanged) {
    return;
  }
  await manager.delete(DiveObservation, { participationId });
  if (observations.length > 0) {
    await manager.insert(
      DiveObservation,
      observations.map(({ label, count }, position) => ({
        participationId,
        position,
        label,
        count,
      })),
    );
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
  return withTeamAndObservations(manager, event, participation);
}

async function withTeamAndObservations(
  manager: EntityManager,
  event: DiveEvent,
  participation: DiveParticipation,
): Promise<Dive> {
  const teams = await loadDiveTeams(manager, [participation.id]);
  const observations = await loadObservations(manager, [participation.id]);
  return {
    event,
    participation,
    buddyIds: teams.get(participation.id) ?? [],
    observations: observations.get(participation.id) ?? [],
  };
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

/** Observations of the participations, ordered by position. */
async function loadObservations(
  manager: EntityManager,
  participationIds: readonly string[],
): Promise<Map<string, DiveObservationValue[]>> {
  const observations = new Map<string, DiveObservationValue[]>();
  if (participationIds.length === 0) {
    return observations;
  }
  const lines = await manager.find(DiveObservation, {
    where: { participationId: In([...participationIds]) },
    order: { participationId: 'ASC', position: 'ASC' },
  });
  for (const { participationId, label, count } of lines) {
    observations.set(participationId, [
      ...(observations.get(participationId) ?? []),
      { label, count },
    ]);
  }
  return observations;
}
