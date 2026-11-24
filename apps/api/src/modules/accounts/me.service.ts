import type { MeResponse } from '@e-deep/shared';
import { Injectable } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { toMeResponse } from './me-contract.mapper';
import { OnboardingService, type OnboardingState } from './onboarding.service';

/** Builds `MeResponse`, the identity answered by `/me`, the sign-up and the web login (D41). */
@Injectable()
export class MeService {
  constructor(
    private readonly accounts: AccountsService,
    private readonly onboarding: OnboardingService,
  ) {}

  /** From the session (`/me`): the email is read from the account. */
  async describe(accountId: string, diverId: string): Promise<MeResponse> {
    return this.describeWith(accountId, await this.onboarding.stateOf(diverId));
  }

  /** With the account already in hand (login, sign-up): no second read of the email. */
  async describeAccount(email: string, diverId: string): Promise<MeResponse> {
    return toMeResponse(email, await this.onboarding.stateOf(diverId));
  }

  /** Same as `describe`, from a state just computed (onboarding). */
  async describeWith(accountId: string, state: OnboardingState): Promise<MeResponse> {
    const { email } = await this.accounts.identityOf(accountId);
    return toMeResponse(email, state);
  }
}
