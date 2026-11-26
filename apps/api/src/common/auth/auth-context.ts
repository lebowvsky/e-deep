import type { AccountRole } from '@e-deep/shared';
import type { Request } from 'express';
import type { SessionAudience } from '../../modules/auth/session-audiences';
import type { ResolvedSession } from '../../modules/auth/session.service';
import { asDiverId, type DiverId } from './diver-id';

/**
 * Who the request acts for (D33), built by the `SessionGuard` once the session is resolved. The
 * business code only ever reads this context (`@CurrentAuth()`, `@CurrentDiverId()`), never the
 * cookie nor the session.
 */
export interface AuthContext {
  readonly accountId: string;
  /** `null` for a staff account (D36). */
  readonly diverId: DiverId | null;
  readonly role: AccountRole;
  readonly audience: SessionAudience;
  /** The session behind the request (rotated or ended by the password and logout routes). */
  readonly sessionId: string;
}

/** The context of a live session: the only production place where a `DiverId` is minted. */
export function authContextOfSession(session: ResolvedSession): AuthContext {
  return {
    accountId: session.accountId,
    diverId: session.diverId === null ? null : asDiverId(session.diverId),
    role: session.role,
    audience: session.audience,
    sessionId: session.sessionId,
  };
}

// Kept beside the request rather than on it: no ad hoc property, no cast, nothing a handler could
// overwrite by accident. Collected with the request.
const contexts = new WeakMap<Request, AuthContext>();

export function attachAuthContext(request: Request, context: AuthContext): void {
  contexts.set(request, context);
}

/** The context attached by the `SessionGuard`; `undefined` on a public route. */
export function authContextOf(request: Request): AuthContext | undefined {
  return contexts.get(request);
}
