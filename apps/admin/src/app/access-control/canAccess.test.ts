import type { StaffRole } from '@e-deep/shared';
import { describe, expect, it } from 'vitest';
import { canAccess } from './canAccess';

const support = { role: 'support' } as const;
const admin = { role: 'admin' } as const;
const BOTH: readonly StaffRole[] = ['support', 'admin'];
const ADMIN_ONLY: readonly StaffRole[] = ['admin'];

describe('canAccess', () => {
  it('grants a role that is allowed', () => {
    expect(canAccess(support, BOTH)).toBe(true);
    expect(canAccess(admin, BOTH)).toBe(true);
    expect(canAccess(admin, ADMIN_ONLY)).toBe(true);
  });

  it('refuses a role that is not allowed', () => {
    expect(canAccess(support, ADMIN_ONLY)).toBe(false);
  });

  it('refuses when no role is allowed', () => {
    expect(canAccess(admin, [])).toBe(false);
  });

  it('refuses without a session', () => {
    expect(canAccess(null, BOTH)).toBe(false);
  });
});
