import { randomUUID } from 'node:crypto';
import type {
  DiveWriteBuddy,
  DiveWriteRequest,
  DiveWriteResponse,
  DiveWriteSite,
} from '@e-deep/shared';
import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { lockIdForTransaction } from '../../common/database/advisory-lock';
import { IdentifierConflictError, InvalidReferenceError } from '../../common/errors/domain-errors';
import { normalizeUuid } from '../../common/ids/uuid';
import { Buddy } from '../buddies/buddy.entity';
import { BuddiesService } from '../buddies/buddies.service';
import { CertificationLevel } from '../certification-levels/certification-level.entity';
import { DiveSite } from '../dive-sites/dive-site.entity';
import { DiveSitesService, resolveMergedSiteIn } from '../dive-sites/dive-sites.service';
import { diveNotFound, DiveLogService } from './dive-log.service';
import { isSameDiveWrite, toDiveWrite } from './dive-write.mapper';
import type { Dive, DiveWrite } from './dive.types';
import { DivesService } from './dives.service';
import type { DiverId } from '../../common/auth/diver-id';

/**
 * Agency of the level codes the write contract carries (`levelCode: 'N3'`, without agency): the
 * front only knows the FFESSM levels for now (D-09, `UserLevel`). To widen with the contract.
 */
const LEVEL_CODE_AGENCY = 'FFESSM';

/** `created`: 201; `replayed`: the same creation received again, nothing written, 200. */
export interface DiveCreation {
  readonly outcome: 'created' | 'replayed';
  readonly saved: DiveWriteResponse;
}

/**
 * Online writes of a dive (`POST` / `PUT /api/dives`, D-24): in one transaction, the site and the
 * buddies created by name, the level of the existing buddies (D-21), then the aggregate of
 * `upsertDive`. Any failure writes nothing. The diver always comes from the caller (the guard).
 *
 * LWW without optimistic control (D-25): the last write received wins; `lastPulledAt` is now, since
 * the client has just read the server state.
 */
@Injectable()
export class DiveWriteService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly dives: DivesService,
    private readonly sites: DiveSitesService,
    private readonly buddies: BuddiesService,
    private readonly diveLog: DiveLogService,
  ) {}

  /**
   * Creates a dive. Receiving the same creation again (same id, live, same content) writes nothing
   * and answers `replayed`.
   *
   * @throws {IdentifierConflictError} when the id is already taken: different content, a deleted
   *   dive or another diver's event, indistinguishable on purpose.
   * @throws {InvalidReferenceError} for a site or buddy unknown or another diver's, including one
   *   to create under another diver's id (D-24: indistinguishable).
   * @throws {DomainError} from the services.
   */
  create(diverId: DiverId, request: DiveWriteRequest): Promise<DiveCreation> {
    return this.dataSource.transaction(async (manager): Promise<DiveCreation> => {
      // Two creations of the same new id: the second waits, then sees the first as `own`.
      await lockIdForTransaction(manager, request.event.id);
      const siteId = await resolveSiteFirst(manager, diverId, request);
      const lookup = await this.dives.findDiveForWriteIn(manager, diverId, request.event.id);
      if (lookup.status === 'foreign') {
        throw new IdentifierConflictError();
      }
      if (lookup.status === 'own') {
        const { dive } = lookup;
        const write = withSite(toDiveWrite(request, dive.participation), siteId);
        if (!isLive(dive) || !isSameDiveWrite(write, dive)) {
          throw new IdentifierConflictError();
        }
        return {
          outcome: 'replayed',
          saved: await this.diveLog.numberOfIn(manager, diverId, request.event.id),
        };
      }
      await this.writeContacts(manager, diverId, request);
      await this.writeDive(
        manager,
        diverId,
        withSite(toDiveWrite(request, { id: randomUUID(), certificationLevelId: null }), siteId),
      );
      return {
        outcome: 'created',
        saved: await this.diveLog.numberOfIn(manager, diverId, request.event.id),
      };
    });
  }

  /**
   * Replaces a live dive of the diver as a whole. Keeps its participation and the level snapshot
   * of the participation (D-09). Neither creates nor restores a dive.
   *
   * @throws {NotFoundException} when the dive is absent, deleted or another diver's (same 404).
   * @throws {InvalidReferenceError} | {DomainError} from the services.
   */
  replace(diverId: DiverId, id: string, request: DiveWriteRequest): Promise<DiveWriteResponse> {
    return this.dataSource.transaction(async (manager) => {
      const siteId = await resolveSiteFirst(manager, diverId, request);
      const lookup = await this.dives.findDiveForWriteIn(manager, diverId, id);
      if (lookup.status !== 'own' || !isLive(lookup.dive)) {
        throw diveNotFound();
      }
      const { participation } = lookup.dive;
      await this.writeContacts(manager, diverId, request);
      await this.writeDive(manager, diverId, withSite(toDiveWrite(request, participation), siteId));
      return this.diveLog.numberOfIn(manager, diverId, id);
    });
  }

  private async writeContacts(
    manager: EntityManager,
    diverId: string,
    request: DiveWriteRequest,
  ): Promise<void> {
    if (request.site.isNew) {
      await this.createSite(manager, diverId, request.site);
    }
    // Sequential (the transaction has a single connection) and sorted by id: two writes sharing
    // buddies lock them in the same order, so they cannot deadlock.
    for (const buddy of sortedById(request.buddies)) {
      if (buddy.isNew) {
        await this.createBuddy(manager, diverId, buddy);
      } else {
        await this.updateBuddyLevel(manager, diverId, buddy);
      }
    }
  }

  /**
   * A site known by its name only (D-23), created from the dive form (`quick`, RG-34). Already the
   * diver's (a retried creation, a site enriched since, or merged since: the dive is then
   * redirected to its target, RG-36): left as is.
   *
   * @throws {InvalidReferenceError} when the id is another diver's site.
   */
  private async createSite(
    manager: EntityManager,
    diverId: string,
    site: DiveWriteSite,
  ): Promise<void> {
    const existing = await manager.findOneBy(DiveSite, { id: site.id });
    if (existing !== null) {
      assertOwnedBy(existing.ownerId, diverId);
      return;
    }
    await this.sites.upsertIn(
      manager,
      diverId,
      {
        id: site.id,
        name: site.name,
        locality: null,
        region: null,
        area: null,
        latitude: null,
        longitude: null,
        type: null,
        depthMinM: null,
        depthMaxM: null,
        accessNotes: null,
        createdVia: 'quick',
        baseUpdatedAt: null,
        deletedAt: null,
      },
      new Date(),
    );
  }

  /**
   * A buddy known by its name (and level). Already the diver's: left as is, like a site.
   *
   * @throws {InvalidReferenceError} when the id is another diver's buddy, or the level unknown.
   */
  private async createBuddy(
    manager: EntityManager,
    diverId: string,
    buddy: DiveWriteBuddy,
  ): Promise<void> {
    const existing = await manager.findOneBy(Buddy, { id: buddy.id });
    if (existing !== null) {
      assertOwnedBy(existing.ownerId, diverId);
      return;
    }
    await this.buddies.upsertIn(
      manager,
      diverId,
      {
        id: buddy.id,
        firstName: buddy.firstName,
        lastName: buddy.lastName,
        linkedDiverId: null,
        certificationLevelId:
          buddy.levelCode === null ? null : await levelIdOf(manager, buddy.levelCode),
        baseUpdatedAt: null,
        deletedAt: null,
      },
      new Date(),
    );
  }

  /**
   * The level chosen in the form is the contact's current level (D-21). `null` keeps it. The
   * contact is only locked when its level changes (most saves keep it, and need no lock); the
   * sheet is then read again under lock and rewritten whole with the new level only.
   *
   * @throws {InvalidReferenceError} for an unknown level, or a buddy that is not the diver's.
   */
  private async updateBuddyLevel(
    manager: EntityManager,
    diverId: string,
    buddy: DiveWriteBuddy,
  ): Promise<void> {
    if (buddy.levelCode === null) {
      return;
    }
    const where = { id: buddy.id, ownerId: diverId };
    const seen = await manager.findOneBy(Buddy, where);
    if (seen === null) {
      throw new InvalidReferenceError();
    }
    const certificationLevelId = await levelIdOf(manager, buddy.levelCode);
    if (seen.certificationLevelId === certificationLevelId) {
      return;
    }
    const current = await manager.findOne(Buddy, { where, lock: { mode: 'pessimistic_write' } });
    if (current === null) {
      throw new InvalidReferenceError();
    }
    if (current.certificationLevelId === certificationLevelId) {
      return;
    }
    await this.buddies.upsertIn(
      manager,
      diverId,
      {
        id: current.id,
        firstName: current.firstName,
        lastName: current.lastName,
        linkedDiverId: current.linkedDiverId,
        certificationLevelId,
        baseUpdatedAt: current.updatedAt,
        deletedAt: current.deletedAt,
      },
      new Date(),
    );
  }

  /**
   * A stale restore cannot happen here (the dive was found live or absent under lock); answered as
   * a missing dive should it ever.
   */
  private async writeDive(
    manager: EntityManager,
    diverId: string,
    write: DiveWrite,
  ): Promise<void> {
    const result = await this.dives.upsertDiveIn(manager, diverId, write, new Date());
    if (result.status === 'rejected') {
      throw diveNotFound();
    }
  }
}

/**
 * The site the dive will reference: a merged site is replaced by its target (RG-36). Resolved
 * first, under a share lock, so that sites are locked before the event, in the order of a merge
 * (sites, then their events): a dive written during a merge cannot deadlock with it.
 */
function resolveSiteFirst(
  manager: EntityManager,
  diverId: string,
  request: DiveWriteRequest,
): Promise<string> {
  return resolveMergedSiteIn(manager, diverId, request.event.siteId);
}

function withSite(write: DiveWrite, siteId: string): DiveWrite {
  return { ...write, event: { ...write.event, siteId } };
}

function isLive({ event, participation }: Dive): boolean {
  return event.deletedAt === null && participation.deletedAt === null;
}

/**
 * An id of another diver cannot be taken over (D-02). Answered like an unknown reference, so that
 * nothing tells another diver's record from a missing one (D-24, ARCHITECTURE §9).
 */
function assertOwnedBy(ownerId: string, diverId: string): void {
  if (ownerId !== diverId) {
    throw new InvalidReferenceError();
  }
}

/** By normalised id, in code-point order: the order of PostgreSQL on `uuid` (`canonicalUuids`). */
function sortedById(buddies: readonly DiveWriteBuddy[]): DiveWriteBuddy[] {
  const keyed = buddies.map((buddy) => ({ buddy, key: normalizeUuid(buddy.id) }));
  keyed.sort((left, right) => (left.key < right.key ? -1 : left.key > right.key ? 1 : 0));
  return keyed.map(({ buddy }) => buddy);
}

/** @throws {InvalidReferenceError} for an unknown code. */
async function levelIdOf(manager: EntityManager, code: string): Promise<string> {
  const level = await manager.findOneBy(CertificationLevel, { agency: LEVEL_CODE_AGENCY, code });
  if (level === null) {
    throw new InvalidReferenceError();
  }
  return level.id;
}
