import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import {
  InactiveCertificationLevelError,
  InvalidReferenceError,
} from '../../common/errors/domain-errors';
import { CertificationLevel } from '../certification-levels/certification-level.entity';
import { Diver } from './diver.entity';

export interface CreateDiverInput {
  readonly firstName: string;
  readonly lastName: string;
  readonly certificationLevelId: string;
  readonly avatarUrl: string | null;
}

/** The minimal sign-up (D36): first name only, no last name nor level until `/welcome`. */
export interface CreateIncompleteDiverInput {
  readonly firstName: string;
}

/** What `/welcome` writes on the profile (D38). */
export interface CompleteProfileInput {
  readonly lastName: string | null;
  readonly certificationLevelId: string;
}

@Injectable()
export class DiversService {
  constructor(private readonly dataSource: DataSource) {}

  /** @throws {InactiveCertificationLevelError} | {InvalidReferenceError} */
  create(input: CreateDiverInput): Promise<Diver> {
    return this.dataSource.transaction(async (manager) => {
      await assertSelectableLevel(manager, input.certificationLevelId);
      const result = await manager.insert(Diver, {
        firstName: input.firstName,
        lastName: input.lastName,
        certificationLevelId: input.certificationLevelId,
        avatarUrl: input.avatarUrl,
      });
      const id: unknown = result.identifiers[0]?.['id'];
      if (typeof id !== 'string') {
        throw new Error('Diver insert returned no id');
      }
      return manager.findOneByOrFail(Diver, { id });
    });
  }

  /**
   * Inserts the diver of a minimal sign-up, inside the caller's transaction (`RegistrationService`).
   * `create` keeps requiring a level (seed, tests).
   */
  async createIncompleteIn(
    manager: EntityManager,
    input: CreateIncompleteDiverInput,
  ): Promise<Diver> {
    const result = await manager.insert(Diver, {
      firstName: input.firstName.trim(),
      lastName: null,
      certificationLevelId: null,
      avatarUrl: null,
    });
    const id: unknown = result.identifiers[0]?.['id'];
    if (typeof id !== 'string') {
      throw new Error('Diver insert returned no id');
    }
    return manager.findOneByOrFail(Diver, { id });
  }

  /**
   * Writes the level (selectable: existing and active) and the optional last name of `/welcome`,
   * inside the caller's transaction (`OnboardingService`).
   *
   * @throws {InactiveCertificationLevelError} | {InvalidReferenceError}
   */
  async completeProfileIn(
    manager: EntityManager,
    diverId: string,
    input: CompleteProfileInput,
  ): Promise<void> {
    await assertSelectableLevel(manager, input.certificationLevelId);
    const result = await manager.update(
      Diver,
      { id: diverId },
      { certificationLevelId: input.certificationLevelId, lastName: input.lastName },
    );
    if (result.affected === 0) {
      throw new InvalidReferenceError();
    }
  }

  /**
   * Changes the diver's current level. Existing participations keep their snapshot (D-09).
   *
   * @throws {InactiveCertificationLevelError} | {InvalidReferenceError}
   */
  changeCertificationLevel(diverId: string, certificationLevelId: string): Promise<Diver> {
    return this.dataSource.transaction(async (manager) => {
      await assertSelectableLevel(manager, certificationLevelId);
      const result = await manager.update(Diver, { id: diverId }, { certificationLevelId });
      if (result.affected === 0) {
        throw new InvalidReferenceError();
      }
      return manager.findOneByOrFail(Diver, { id: diverId });
    });
  }

  /**
   * GDPR erasure: physical deletion, cascading to every record of the diver (no tombstone). Other
   * divers' contacts linked to this account are unlinked (`ON DELETE SET NULL`).
   *
   * In the MVP an event only has its creator's participation, so deleting the creator never erases
   * another diver's participation. When dives become shared (D-08), the events shared with other
   * participants will first be transferred to one of them, here, inside this same transaction and
   * before the DELETE.
   */
  async deleteAccount(diverId: string): Promise<void> {
    await this.dataSource.transaction((manager) => this.deleteAccountIn(manager, diverId));
  }

  /** Same as `deleteAccount`, inside the caller's transaction (`AccountsService`). */
  async deleteAccountIn(manager: EntityManager, diverId: string): Promise<void> {
    // (Sharing, D-08) transfer of the shared events goes here.
    await manager.delete(Diver, { id: diverId });
  }
}

/** The current level of a diver must exist and be active when chosen. */
async function assertSelectableLevel(
  manager: EntityManager,
  certificationLevelId: string,
): Promise<void> {
  const level = await manager.findOneBy(CertificationLevel, { id: certificationLevelId });
  if (level === null) {
    throw new InvalidReferenceError();
  }
  if (!level.isActive) {
    throw new InactiveCertificationLevelError();
  }
}
