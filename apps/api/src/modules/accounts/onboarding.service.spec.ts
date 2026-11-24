import type { DataSource, EntityManager } from 'typeorm';
import { DomainValidationError, OnboardingCompleteError } from '../../common/errors/domain-errors';
import type { AuthEventsService } from '../auth/auth-events.service';
import { ConsentsService } from '../consents/consents.service';
import type { DiversService } from '../divers/divers.service';
import type { Consent } from '../consents/consent.entity';
import { OnboardingService, onboardingStatusOf, type OnboardingState } from './onboarding.service';

describe('onboardingStatusOf', () => {
  it.each([
    ['no level', null, null, 'profile-required'],
    ['no level, even with a current consent', null, '2026-11', 'profile-required'],
    ['a level without any consent (D38)', 'level-n1', null, 'profile-required'],
    ['a level with an outdated consent', 'level-n1', '2025-06', 'consent-required'],
    ['a level with a current consent', 'level-n1', '2026-11', 'complete'],
  ] as const)('%s → %s', (_label, certificationLevelId, policyVersion, status) => {
    const consent = policyVersion === null ? null : { policyVersion };
    expect(onboardingStatusOf({ certificationLevelId }, consent)).toBe(status);
  });
});

describe('OnboardingService.complete', () => {
  function setup(certificationLevelId: string | null, livePolicyVersion: string | null = null) {
    const manager = {
      findOneOrFail: jest.fn().mockResolvedValue({ id: 'diver-1', certificationLevelId }),
      // Live consent lookup; also answers the diver lock of `grantIn` (ignored).
      findOneBy: jest
        .fn()
        .mockResolvedValue(
          livePolicyVersion === null ? null : { policyVersion: livePolicyVersion },
        ),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const dataSource = {
      manager,
      transaction: (run: (m: EntityManager) => Promise<unknown>) =>
        run(manager as unknown as EntityManager),
    };
    const divers = { completeProfileIn: jest.fn().mockResolvedValue(undefined) };
    const consents = new ConsentsService(
      dataSource as unknown as DataSource,
      { recordIn: jest.fn() } as unknown as AuthEventsService,
    );
    const service = new OnboardingService(
      dataSource as unknown as DataSource,
      divers as unknown as DiversService,
      consents,
    );
    return { service, divers, consents };
  }

  const input = {
    accountId: 'account-1',
    diverId: 'diver-1',
    lastName: null,
    certificationLevelId: 'level-n1',
    policyVersion: '2026-11',
  };

  it('refuses a policy version that is not the current one', async () => {
    const { service } = setup(null);

    await expect(service.complete({ ...input, policyVersion: '2025-06' })).rejects.toMatchObject(
      new DomainValidationError({ policyVersion: ['outdated'] }),
    );
  });

  it.each([
    ['complete', '2026-11'],
    ['consent-required (outdated consent: /me/consents)', '2025-06'],
  ])('refuses a %s diver, before writing anything', async (_label, livePolicyVersion) => {
    const { service, divers } = setup('level-n1', livePolicyVersion);

    await expect(service.complete(input)).rejects.toThrow(OnboardingCompleteError);
    expect(divers.completeProfileIn).not.toHaveBeenCalled();
  });

  it('accepts a diver with a level but no consent at all (profile-required, D38)', async () => {
    const { service, divers, consents } = setup('level-n1');
    // The writes themselves are covered by test:db; here, only the gate matters.
    const grantIn = jest.spyOn(consents, 'grantIn').mockResolvedValue({} as Consent);
    const state = { status: 'complete' } as OnboardingState;
    jest.spyOn(service, 'stateOf').mockResolvedValue(state);

    await expect(service.complete(input)).resolves.toBe(state);
    expect(grantIn).toHaveBeenCalledTimes(1);
    expect(divers.completeProfileIn).toHaveBeenCalledWith(expect.anything(), 'diver-1', {
      lastName: null,
      certificationLevelId: 'level-n1',
    });
  });
});
