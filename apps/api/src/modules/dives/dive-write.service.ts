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
import { Buddy } from '../buddies/buddy.entity';
import { BuddiesService } from '../buddies/buddies.service';
import { CertificationLevel } from '../certification-levels/certification-level.entity';
import { DiveSite } from '../dive-sites/dive-site.entity';
import { DiveSitesService } from '../dive-sites/dive-sites.service';
import { diveNotFound, DiveLogService } from './dive-log.service';
import { isSameDiveWrite, toDiveWrite } from './dive-write.mapper';
import type { Dive, DiveWrite } from './dive.types';
import { DivesService } from './dives.service';

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
   * @throws {InvalidReferenceError} | {DomainError} from the services.
   */
  async create(diverId: string, request: DiveWriteRequest): Promise<DiveCreation> {
    const outcome = await this.dataSource.transaction(async (manager) => {
      // Two creations of the same new id: the second waits, then sees the first as `own`.
      await lockIdForTransaction(manager, request.event.id);
      const lookup = await this.dives.findDiveForWriteIn(manager, diverId, request.event.id);
      if (lookup.status === 'foreign') {
        throw new IdentifierConflictError();
      }
      if (lookup.status === 'own') {
        const { dive } = lookup;
        if (!isLive(dive) || !isSameDiveWrite(toDiveWrite(request, dive.participation), dive)) {
          throw new IdentifierConflictError();
        }
        return 'replayed';
      }
      await this.writeContacts(manager, diverId, request);
      await this.writeDive(
        manager,
        diverId,
        toDiveWrite(request, { id: randomUUID(), certificationLevelId: null }),
      );
      return 'created';
    });
    return { outcome, saved: await this.diveLog.numberOf(diverId, request.event.id) };
  }

  /**
   * Replaces a live dive of the diver as a whole. Keeps its participation and the level snapshot
   * of the participation (D-09). Neither creates nor restores a dive.
   *
   * @throws {NotFoundException} when the dive is absent, deleted or another diver's (same 404).
   * @throws {InvalidReferenceError} | {DomainError} from the services.
   */
  async replace(
    diverId: string,
    id: string,
    request: DiveWriteRequest,
  ): Promise<DiveWriteResponse> {
    await this.dataSource.transaction(async (manager) => {
      const lookup = await this.dives.findDiveForWriteIn(manager, diverId, id);
      if (lookup.status !== 'own' || !isLive(lookup.dive)) {
        throw diveNotFound();
      }
      const { participation } = lookup.dive;
      await this.writeContacts(manager, diverId, request);
      await this.writeDive(manager, diverId, toDiveWrite(request, participation));
    });
    return this.diveLog.numberOf(diverId, id);
  }

  private async writeContacts(
    manager: EntityManager,
    diverId: string,
    request: DiveWriteRequest,
  ): Promise<void> {
    if (request.site.isNew) {
      await this.createSite(manager, diverId, request.site);
    }
    // Sequential: the transaction has a single connection.
    for (const buddy of request.buddies) {
      if (buddy.isNew) {
        await this.createBuddy(manager, diverId, buddy);
      } else {
        await this.updateBuddyLevel(manager, diverId, buddy);
      }
    }
  }

  /**
   * A site known by its name only (D-23). Already the diver's (a retried creation, or a site
   * enriched since): left as is.
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
        baseUpdatedAt: null,
        deletedAt: null,
      },
      new Date(),
    );
  }

  /** A buddy known by its name (and level). Already the diver's: left as is, like a site. */
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
   * contact sheet is rewritten whole, from its locked state, with the new level only.
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
    const current = await manager.findOne(Buddy, {
      where: { id: buddy.id, ownerId: diverId },
      lock: { mode: 'pessimistic_write' },
    });
    if (current === null) {
      throw new InvalidReferenceError();
    }
    const certificationLevelId = await levelIdOf(manager, buddy.levelCode);
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

function isLive({ event, participation }: Dive): boolean {
  return event.deletedAt === null && participation.deletedAt === null;
}

/** An id of another diver cannot be taken over (D-02). */
function assertOwnedBy(ownerId: string, diverId: string): void {
  if (ownerId !== diverId) {
    throw new IdentifierConflictError();
  }
}

/** @throws {InvalidReferenceError} for an unknown code. */
async function levelIdOf(manager: EntityManager, code: string): Promise<string> {
  const level = await manager.findOneBy(CertificationLevel, { agency: LEVEL_CODE_AGENCY, code });
  if (level === null) {
    throw new InvalidReferenceError();
  }
  return level.id;
}
