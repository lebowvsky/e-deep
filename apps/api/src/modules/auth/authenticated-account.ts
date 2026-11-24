import type { AccountRole } from '@e-deep/shared';
import type { Account } from '../accounts/account.entity';

/**
 * What a sign-in or a sign-up hands to its caller (the controllers build `MeResponse` from it): never the
 * entity, which carries the password hash (and a stale one after a rehash).
 */
export interface AuthenticatedAccount {
  readonly id: string;
  readonly email: string;
  readonly role: AccountRole;
  /** `null` for a staff account (D36). */
  readonly diverId: string | null;
}

export function toAuthenticatedAccount({
  id,
  email,
  role,
  diverId,
}: Account): AuthenticatedAccount {
  return { id, email, role, diverId };
}
