import type { AccountRole } from '@e-deep/shared';
import { ACCOUNT_ROLES, isStaffRole } from './account-lists';

// `Record<AccountRole, …>` does not compile if a role of the shared union is missing here.
const EVERY_ROLE: Record<AccountRole, true> = { diver: true, support: true, admin: true };

describe('ACCOUNT_ROLES', () => {
  it('lists every AccountRole of the shared contract', () => {
    expect([...ACCOUNT_ROLES].sort()).toEqual(Object.keys(EVERY_ROLE).sort());
  });
});

describe('isStaffRole', () => {
  it('accepts every role but diver', () => {
    expect(ACCOUNT_ROLES.filter(isStaffRole)).toEqual(['support', 'admin']);
  });
});
