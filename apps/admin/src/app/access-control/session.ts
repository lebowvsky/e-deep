import type { AdminMeResponse } from '@e-deep/shared';
import { createContext, use } from 'react';

/** The signed-in staff member, as `GET /api/admin/me` describes them: roles come from the API only. */
export type AdminSession = AdminMeResponse['account'];

/** Fed by the loader of the protected layout (`requireStaffSession`); tests provide their own. */
export const SessionContext = createContext<AdminSession | null>(null);

/** The session of the protected pages. Throws outside of them: a page there has no session. */
export function useSession(): AdminSession {
  const session = use(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside <SessionContext value={…}>.');
  }
  return session;
}
