import type { AccountRole } from '@e-deep/shared';
import type { Request } from 'express';
import type { SessionAudience } from '../../modules/auth/session-audiences';
import type { ResolvedSession } from '../../modules/auth/session.service';
import { UnauthenticatedError } from '../errors/domain-errors';
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
  /**
   * The session behind the request; `null` only for the `DEV_AUTH_STUB` fallback, which has none
   * (removed in auth lot 6). Routes that rotate or revoke the caller's session refuse it.
   */
  readonly sessionId: string | null;
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

/**
 * The session of a route that rotates or ends it (`PUT /me/password`, `DELETE /me`,
 * `POST /auth/logout-all`).
 *
 * @throws {UnauthenticatedError} for the `DEV_AUTH_STUB` fallback (until lot 6): there is no
 *   session to rotate or end, so these routes need a real sign-in.
 */
export function requireSessionId(auth: AuthContext): string {
  if (auth.sessionId === null) {
    throw new UnauthenticatedError();
  }
  return auth.sessionId;
}

/** The diver account the `DEV_AUTH_STUB` fallback acts for (`DevAuthStub`). */
export interface DevStubAccount {
  readonly accountId: string;
  readonly diverId: string;
}

/**
 * DEVELOPMENT ONLY (until auth lot 6): the context of the first diver, without a session. Built by
 * the `SessionGuard` only when no web cookie is presented, `DEV_AUTH_STUB=true` and
 * `NODE_ENV≠production`.
 */
export function devStubAuthContext(account: DevStubAccount): AuthContext {
  return {
    accountId: account.accountId,
    diverId: asDiverId(account.diverId),
    role: 'diver',
    audience: 'web',
    sessionId: null,
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
