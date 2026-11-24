import type { StaffRole } from '@e-deep/shared';
import {
  createParamDecorator,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { isStaffRole } from '../../modules/accounts/account-lists';
import type { SessionAudience } from '../../modules/auth/session-audiences';
import { SessionService, type ResolvedSession } from '../../modules/auth/session.service';
import { ForbiddenError, UnauthenticatedError } from '../errors/domain-errors';
import { SessionCookies } from './session-cookie';

// TEMPORARY (auth lot 3): these guards protect `/me`, `/auth/logout-all` and `/admin/me` only.
// Lot 4 replaces them with the global `SessionGuard` (`APP_GUARD`), its `AuthContext` and the
// `@Roles` / `@CurrentDiverId()` decorators; the business routes stay on `CurrentDiverGuard` until
// then.

/** Session of a diver on the web audience: the diver is known. */
export type DiverSession = Omit<ResolvedSession, 'diverId' | 'role'> & {
  readonly diverId: string;
  readonly role: 'diver';
};

/** Session of a staff account on the admin audience: there is no diver (D36). */
export type StaffSession = Omit<ResolvedSession, 'diverId' | 'role'> & {
  readonly role: StaffRole;
};

interface RequestWithSession extends Request {
  diverSession?: DiverSession;
  staffSession?: StaffSession;
}

/**
 * Reads the audience cookie, resolves the session (`SessionService.resolve`), checks the role,
 * records the activity (`touch`) and hands the session to the handler. Answers `401
 * unauthenticated` without a single live session of the audience, `403 forbidden` for a role the
 * route does not serve. Marks every response `no-store` first, errors included.
 */
abstract class LocalSessionGuard<T> implements CanActivate {
  protected abstract readonly audience: SessionAudience;

  constructor(
    private readonly cookies: SessionCookies,
    private readonly sessions: SessionService,
  ) {}

  /** The session narrowed for the route, `null` when its role is not allowed. */
  protected abstract narrow(session: ResolvedSession): T | null;

  protected abstract attach(request: RequestWithSession, session: T): void;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    http.getResponse<Response>().setHeader('Cache-Control', 'no-store');
    const request = http.getRequest<RequestWithSession>();
    const token = this.cookies.token(request, this.audience);
    const session = token === null ? null : await this.sessions.resolve(token, this.audience);
    if (session === null) {
      throw new UnauthenticatedError();
    }
    const narrowed = this.narrow(session);
    if (narrowed === null) {
      throw new ForbiddenError();
    }
    await this.sessions.touch(session);
    this.attach(request, narrowed);
    return true;
  }
}

/**
 * Web routes of a diver (`/me`, `/auth/logout-all`). A staff account is `403 forbidden` here only
 * as defence in depth: the real `SessionService.resolve` already returns `null` for a role that
 * does not match the audience, so in practice a staff cookie on `/me` ends in `401`.
 */
@Injectable()
export class WebSessionGuard extends LocalSessionGuard<DiverSession> {
  protected readonly audience = 'web';

  constructor(cookies: SessionCookies, sessions: SessionService) {
    super(cookies, sessions);
  }

  protected narrow(session: ResolvedSession): DiverSession | null {
    const { diverId, role } = session;
    return role === 'diver' && diverId !== null ? { ...session, diverId, role } : null;
  }

  protected attach(request: RequestWithSession, session: DiverSession): void {
    request.diverSession = session;
  }
}

/**
 * Admin routes (`/admin/me`): staff roles only (`support`, `admin`). The `403 forbidden` for a diver
 * is defence in depth, unreachable with the real `SessionService.resolve` (see `WebSessionGuard`).
 */
@Injectable()
export class AdminSessionGuard extends LocalSessionGuard<StaffSession> {
  protected readonly audience = 'admin';

  constructor(cookies: SessionCookies, sessions: SessionService) {
    super(cookies, sessions);
  }

  protected narrow(session: ResolvedSession): StaffSession | null {
    const { role } = session;
    return isStaffRole(role) ? { ...session, role } : null;
  }

  protected attach(request: RequestWithSession, session: StaffSession): void {
    request.staffSession = session;
  }
}

/** The diver session resolved by `WebSessionGuard` (the guard must run on the route). */
export const CurrentDiverSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): DiverSession => {
    const session = context.switchToHttp().getRequest<RequestWithSession>().diverSession;
    if (session === undefined) {
      throw new Error('WebSessionGuard did not run on this route');
    }
    return session;
  },
);

/** The staff session resolved by `AdminSessionGuard` (the guard must run on the route). */
export const CurrentStaffSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): StaffSession => {
    const session = context.switchToHttp().getRequest<RequestWithSession>().staffSession;
    if (session === undefined) {
      throw new Error('AdminSessionGuard did not run on this route');
    }
    return session;
  },
);
