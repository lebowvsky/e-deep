import type { OnboardingStatus } from '@e-deep/shared';
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OnboardingCompleteError, UnauthenticatedError } from '../../common/errors/domain-errors';
import type { Consent } from '../consents/consent.entity';
import { ConsentsService } from '../consents/consents.service';
import {
  CURRENT_HEALTH_POLICY_VERSION,
  assertCurrentHealthPolicyVersion,
} from '../consents/health-policy-versions';
import { Diver } from '../divers/diver.entity';
import { DiversService } from '../divers/divers.service';

const HEALTH_DATA = 'health_data_processing';

/** Body of `POST /me/onboarding` (`OnboardingRequest`) with the caller's identity (AuthContext). */
export interface OnboardingInput {
  readonly accountId: string;
  readonly diverId: string;
  /** Optional; blank is stored as `null`. */
  readonly lastName: string | null;
  readonly certificationLevelId: string;
  /** See `GrantConsentInput.policyVersion`. */
  readonly policyVersion: string;
}

/** What `GET /me` needs about the profile (`MeService`). */
export interface OnboardingState {
  /** With its `certificationLevel` relation (`null` before onboarding). */
  readonly diver: Diver;
  /** Live health data consent, whatever its version. */
  readonly consent: Consent | null;
  readonly status: OnboardingStatus;
}

/**
 * Status computed by the API only (the front never recomputes it, §3), per D38:
 * - `profile-required`: no level, or no live consent at all: `/welcome` to do (lot 4 answers
 *   `403 onboarding-required`);
 * - `consent-required`: a level and a live consent of an outdated policy version: re-consent
 *   through `/me/consents` (`403 consent-required`);
 * - `complete`: a level and a live consent at the current version.
 */
export function onboardingStatusOf(
  diver: Pick<Diver, 'certificationLevelId'>,
  consent: Pick<Consent, 'policyVersion'> | null,
): OnboardingStatus {
  if (diver.certificationLevelId === null || consent === null) {
    return 'profile-required';
  }
  if (consent.policyVersion !== CURRENT_HEALTH_POLICY_VERSION) {
    return 'consent-required';
  }
  return 'complete';
}

/**
 * First launch (`/welcome`, D38): the level, the optional last name and the health data consent,
 * written in a single transaction. Allowed while the status is `profile-required` (a diver with a
 * level but no consent rewrites them and consents); refused otherwise: a `consent-required` diver
 * re-consents through `/me/consents`.
 */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly diversService: DiversService,
    private readonly consentsService: ConsentsService,
  ) {}

  /**
   * @throws {UnauthenticatedError} when the diver is gone (account deleted during the request): the
   *   session it came from no longer exists.
   */
  async stateOf(diverId: string): Promise<OnboardingState> {
    const diver = await this.dataSource.manager.findOne(Diver, {
      where: { id: diverId },
      relations: { certificationLevel: true },
    });
    if (diver === null) {
      throw new UnauthenticatedError();
    }
    const consent = await this.consentsService.findLive(diverId, HEALTH_DATA);
    return { diver, consent, status: onboardingStatusOf(diver, consent) };
  }

  /**
   * @throws {OnboardingCompleteError} when the status is not `profile-required`.
   * @throws {DomainValidationError} `fieldErrors.policyVersion` for a version that is not current.
   * @throws {InactiveCertificationLevelError} | {InvalidReferenceError} for the level.
   */
  async complete(input: OnboardingInput): Promise<OnboardingState> {
    assertCurrentHealthPolicyVersion(input.policyVersion);
    await this.dataSource.transaction(async (manager) => {
      // Locked: two concurrent onboardings cannot both pass the check.
      const diver = await manager.findOneOrFail(Diver, {
        where: { id: input.diverId },
        lock: { mode: 'pessimistic_write' },
      });
      const consent = await this.consentsService.findLiveIn(manager, input.diverId, HEALTH_DATA);
      if (onboardingStatusOf(diver, consent) !== 'profile-required') {
        throw new OnboardingCompleteError();
      }
      await this.diversService.completeProfileIn(manager, input.diverId, {
        lastName: blankToNull(input.lastName),
        certificationLevelId: input.certificationLevelId,
      });
      await this.consentsService.grantIn(manager, {
        accountId: input.accountId,
        diverId: input.diverId,
        purpose: HEALTH_DATA,
        policyVersion: input.policyVersion,
      });
    });
    return this.stateOf(input.diverId);
  }
}

function blankToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}
