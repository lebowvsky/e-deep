import type { ConsentPurpose } from '@e-deep/shared';
import { Injectable } from '@nestjs/common';
import { DataSource, IsNull, type EntityManager } from 'typeorm';
import { AuthEventsService } from '../auth/auth-events.service';
import { Diver } from '../divers/diver.entity';
import { Consent } from './consent.entity';
import { assertCurrentHealthPolicyVersion } from './health-policy-versions';

export interface GrantConsentInput {
  /** Account of the diver, for the `consent_granted` trail. */
  readonly accountId: string;
  readonly diverId: string;
  readonly purpose: ConsentPurpose;
  /**
   * The version the diver saw. A `string`, not the union: the DTO narrows it to a known
   * `HealthPolicyVersion`, and this service refuses any that is not the current one.
   */
  readonly policyVersion: string;
}

/**
 * Consents of a diver (GDPR art. 9.2.a, D38). Granting withdraws the live consent and inserts the
 * new one in a single transaction, so the history of versions is kept. Only the current policy
 * version can be granted. In V1 there is no withdrawal alone: withdrawing is deleting the account.
 */
@Injectable()
export class ConsentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly authEvents: AuthEventsService,
  ) {}

  /** The live (not withdrawn) consent of the diver for `purpose`, whatever its version. */
  findLive(diverId: string, purpose: ConsentPurpose): Promise<Consent | null> {
    return this.findLiveIn(this.dataSource.manager, diverId, purpose);
  }

  findLiveIn(
    manager: EntityManager,
    diverId: string,
    purpose: ConsentPurpose,
  ): Promise<Consent | null> {
    return manager.findOneBy(Consent, { diverId, purpose, withdrawnAt: IsNull() });
  }

  /** @throws {DomainValidationError} `fieldErrors.policyVersion: ['outdated']`. */
  grant(input: GrantConsentInput): Promise<Consent> {
    return this.dataSource.transaction((manager) => this.grantIn(manager, input));
  }

  /**
   * Same as `grant`, inside the caller's transaction (`OnboardingService`). Granting the version
   * already live is a no-op that returns it.
   *
   * @throws {DomainValidationError} `fieldErrors.policyVersion: ['outdated']`.
   */
  async grantIn(manager: EntityManager, input: GrantConsentInput): Promise<Consent> {
    assertCurrentHealthPolicyVersion(input.policyVersion);
    // Serialises the grants of a diver: two concurrent ones cannot both insert a live consent
    // (`uq_consents__live` would answer a 500).
    await manager.findOne(Diver, {
      where: { id: input.diverId },
      lock: { mode: 'pessimistic_write' },
    });
    const live = await this.findLiveIn(manager, input.diverId, input.purpose);
    if (live?.policyVersion === input.policyVersion) {
      return live;
    }
    // `now()` is the transaction start: the withdrawal can never precede the grant it ends
    // (`ck_consents__withdrawn_after_granted`), whatever the clock of the API.
    await manager
      .createQueryBuilder()
      .update(Consent)
      .set({ withdrawnAt: () => 'now()' })
      .where('diver_id = :diverId AND purpose = :purpose AND withdrawn_at IS NULL', {
        diverId: input.diverId,
        purpose: input.purpose,
      })
      .execute();
    await manager.insert(Consent, {
      diverId: input.diverId,
      purpose: input.purpose,
      policyVersion: input.policyVersion,
    });
    await this.authEvents.recordIn(manager, input.accountId, 'consent_granted');
    const granted = await this.findLiveIn(manager, input.diverId, input.purpose);
    if (granted === null) {
      throw new Error('Granted consent not found');
    }
    return granted;
  }
}
