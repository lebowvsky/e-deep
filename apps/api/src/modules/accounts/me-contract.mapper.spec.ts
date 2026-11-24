import { UnsupportedContractValueError } from '../../common/errors/domain-errors';
import type { CertificationLevel } from '../certification-levels/certification-level.entity';
import type { Consent } from '../consents/consent.entity';
import type { Diver } from '../divers/diver.entity';
import { toAdminMeResponse, toMeResponse } from './me-contract.mapper';

const LEVEL = { agency: 'FFESSM', code: 'N2', label: 'Niveau 2' } as CertificationLevel;
const DIVER = {
  id: 'diver-1',
  firstName: 'Lou',
  lastName: null,
  certificationLevelId: null,
  certificationLevel: null,
  avatarUrl: null,
} as Diver;
const CONSENT = {
  policyVersion: '2026-11',
  grantedAt: new Date('2026-11-20T08:00:00.000Z'),
} as Consent;

describe('toMeResponse', () => {
  it('describes an incomplete profile right after sign-up', () => {
    expect(
      toMeResponse('lou@example.test', { diver: DIVER, consent: null, status: 'profile-required' }),
    ).toStrictEqual({
      account: { email: 'lou@example.test', role: 'diver' },
      diver: { id: 'diver-1', firstName: 'Lou', lastName: null, level: null, avatarUrl: null },
      consent: null,
      currentPolicyVersion: '2026-11',
      onboarding: 'profile-required',
    });
  });

  it('describes a complete profile with its level and consent', () => {
    const diver = { ...DIVER, lastName: 'Martin', certificationLevel: LEVEL } as Diver;

    const me = toMeResponse('lou@example.test', { diver, consent: CONSENT, status: 'complete' });

    expect(me.diver.level).toStrictEqual({ agency: 'FFESSM', code: 'N2', label: 'Niveau 2' });
    expect(me.diver.lastName).toBe('Martin');
    expect(me.consent).toStrictEqual({
      policyVersion: '2026-11',
      grantedAt: '2026-11-20T08:00:00.000Z',
    });
    expect(me.onboarding).toBe('complete');
  });

  it('refuses a stored policy version the contract does not know', () => {
    const consent = { ...CONSENT, policyVersion: '1999-01' } as Consent;

    expect(() =>
      toMeResponse('lou@example.test', { diver: DIVER, consent, status: 'consent-required' }),
    ).toThrow(UnsupportedContractValueError);
  });
});

describe('toAdminMeResponse', () => {
  it('carries the email and the staff role only', () => {
    expect(toAdminMeResponse('support@example.test', 'support')).toStrictEqual({
      account: { email: 'support@example.test', role: 'support' },
    });
  });
});
