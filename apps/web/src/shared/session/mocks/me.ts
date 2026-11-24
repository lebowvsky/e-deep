// The `/me` of the tests and of the dev `?state=` forcing: Marine Rousseau of the mockups, signed
// in, profile complete (same id as the dashboard mocks' `mockUser`).
import type { MeResponse } from '@e-deep/shared';

export const ME_FIXTURE: MeResponse = {
  account: { email: 'marine.rousseau@example.test', role: 'diver' },
  diver: {
    id: 'u1',
    firstName: 'Marine',
    lastName: 'Rousseau',
    level: { agency: 'FFESSM', code: 'N2', label: 'Niveau 2' },
    avatarUrl: null,
  },
  consent: { policyVersion: '2026-11', grantedAt: '2026-11-20T09:00:00.000Z' },
  currentPolicyVersion: '2026-11',
  onboarding: 'complete',
};

/** Just signed up: first name only, no level, no consent yet (D36). */
export const NEW_ACCOUNT_FIXTURE: MeResponse = {
  ...ME_FIXTURE,
  diver: { ...ME_FIXTURE.diver, lastName: null, level: null },
  consent: null,
  onboarding: 'profile-required',
};
