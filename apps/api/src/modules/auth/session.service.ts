import type { AccountRole } from '@e-deep/shared';
import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { UnauthenticatedError } from '../../common/errors/domain-errors';
import { CLOCK, type Clock } from '../../common/time/clock';
import type { SessionAudience } from './session-audiences';
import { Session } from './session.entity';
import { SESSION_LIFETIMES, absoluteLifetimeMs, isPersistentSession } from './session-lifetimes';

const TOKEN_BYTES = 32;
/** 32 bytes in base64url, without padding. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** A session just opened or rotated: what the cookie needs (lot 3). The token is never stored. */
export interface IssuedSession {
  readonly sessionId: string;
  /** Opaque token for the cookie, shown once. Never logged. */
  readonly token: string;
  /** Absolute expiry: `Max-Age` of a persistent cookie. */
  readonly expiresAt: Date;
  /** `false`: browser-session cookie, without `Max-Age` (web without « Rester connecté », admin). */
  readonly persistent: boolean;
}

/** A live session read from its token: the material of the future `AuthContext` (D33). */
export interface ResolvedSession {
  readonly sessionId: string;
  readonly accountId: string;
  /** `null` for a staff account (D36). */
  readonly diverId: string | null;
  readonly role: AccountRole;
  readonly audience: SessionAudience;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
}

export interface CreateSessionOptions {
  /** « Rester connecté » (D33); ignored for the admin audience, always short (D42). */
  readonly rememberMe: boolean;
}

/**
 * Opaque server sessions (D33, D42). The token is 32 random bytes in base64url; only its SHA-256
 * is stored. Expiry is absolute (`expires_at`) or by inactivity (`last_seen_at` + the audience's
 * idle window, `session-lifetimes.ts`). Expired sessions are refused on read and deleted by
 * `PurgeService`.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  create(
    accountId: string,
    audience: SessionAudience,
    options: CreateSessionOptions,
  ): Promise<IssuedSession> {
    return this.createIn(this.dataSource.manager, accountId, audience, options);
  }

  /** Same as `create`, inside the caller's transaction (sign-up, login). */
  async createIn(
    manager: EntityManager,
    accountId: string,
    audience: SessionAudience,
    { rememberMe }: CreateSessionOptions,
  ): Promise<IssuedSession> {
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + absoluteLifetimeMs(audience, rememberMe));
    const token = newToken();
    const result = await manager.insert(Session, {
      accountId,
      tokenHash: hashToken(token),
      audience,
      // Written from the injected clock (not `now()` in SQL): expiries and the derived
      // persistence (`isPersistentSession`) are computed against the same time source.
      createdAt: now,
      lastSeenAt: now,
      expiresAt,
    });
    const sessionId: unknown = result.identifiers[0]?.['id'];
    if (typeof sessionId !== 'string') {
      throw new Error('Session insert returned no id');
    }
    return {
      sessionId,
      token,
      expiresAt,
      persistent: isPersistentSession(audience, now, expiresAt),
    };
  }

  /**
   * The live session of `token` for `audience`, with its account; `null` when the token is
   * malformed or unknown, the session belongs to the other audience, its account's role does not
   * match the audience (diver ↔ web, staff ↔ admin: defence in depth, the login already checks it),
   * or it has expired (absolute or idle). Does not touch it (see `touch`).
   */
  async resolve(token: string, audience: SessionAudience): Promise<ResolvedSession | null> {
    if (!TOKEN_PATTERN.test(token)) {
      return null;
    }
    const session = await this.dataSource.manager.findOne(Session, {
      where: { tokenHash: hashToken(token) },
      relations: { account: true },
    });
    if (session?.account === undefined || session.audience !== audience) {
      return null;
    }
    if (!roleMatchesAudience(session.account.role, audience)) {
      return null;
    }
    if (isExpired(session, this.clock.now())) {
      return null;
    }
    return {
      sessionId: session.id,
      accountId: session.accountId,
      diverId: session.account.diverId,
      role: session.account.role,
      audience: session.audience,
      lastSeenAt: session.lastSeenAt,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Records activity: writes `last_seen_at` at most once per touch interval of the audience
   * (an hour on the web, a minute on the admin). Returns whether it was written.
   */
  async touch(session: ResolvedSession): Promise<boolean> {
    const now = this.clock.now();
    const threshold = new Date(now.getTime() - SESSION_LIFETIMES[session.audience].touchIntervalMs);
    if (session.lastSeenAt.getTime() > threshold.getTime()) {
      return false;
    }
    // The condition is repeated in SQL: two concurrent requests write it once.
    const result = await this.dataSource.manager
      .createQueryBuilder()
      .update(Session)
      .set({ lastSeenAt: now })
      .where('id = :id', { id: session.sessionId })
      .andWhere('last_seen_at <= :threshold', { threshold })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  /**
   * Deletes the session of `token` for `audience` (logout): a web cookie never ends an admin
   * session. Idempotent: an unknown token is a no-op. The `logout` event is recorded by the caller
   * (lot 3 controller), which knows the account.
   */
  async revoke(token: string, audience: SessionAudience): Promise<void> {
    if (!TOKEN_PATTERN.test(token)) {
      return;
    }
    await this.dataSource.manager.delete(Session, { tokenHash: hashToken(token), audience });
  }

  /**
   * Deletes every session of the account but `exceptSessionId`; returns how many were deleted.
   * The `sessions_revoked` event is recorded by the caller (lot 3 `logout-all` controller); a
   * password change records `password_changed` instead.
   */
  revokeAll(accountId: string, exceptSessionId?: string): Promise<number> {
    return this.revokeAllIn(this.dataSource.manager, accountId, exceptSessionId);
  }

  async revokeAllIn(
    manager: EntityManager,
    accountId: string,
    exceptSessionId?: string,
  ): Promise<number> {
    const query = manager
      .createQueryBuilder()
      .delete()
      .from(Session)
      .where('account_id = :accountId', { accountId });
    if (exceptSessionId !== undefined) {
      query.andWhere('id <> :exceptSessionId', { exceptSessionId });
    }
    return (await query.execute()).affected ?? 0;
  }

  /**
   * Gives the session a new token (password change): the old cookie stops working at once. The
   * expiry and the persistence are kept, so a rotation never extends a session.
   *
   * @throws {UnauthenticatedError} when the session no longer exists (revoked meanwhile) or is not
   *   the account's.
   */
  async rotateIn(
    manager: EntityManager,
    accountId: string,
    sessionId: string,
  ): Promise<IssuedSession> {
    const token = newToken();
    const result = await manager.update(
      Session,
      { id: sessionId, accountId },
      { tokenHash: hashToken(token) },
    );
    if (result.affected === 0) {
      throw new UnauthenticatedError();
    }
    const session = await manager.findOneByOrFail(Session, { id: sessionId });
    return {
      sessionId,
      token,
      expiresAt: session.expiresAt,
      persistent: isPersistentSession(session.audience, session.createdAt, session.expiresAt),
    };
  }
}

function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

function roleMatchesAudience(role: AccountRole, audience: SessionAudience): boolean {
  return audience === 'web' ? role === 'diver' : role !== 'diver';
}

function isExpired(session: Session, now: Date): boolean {
  const idleDeadline = session.lastSeenAt.getTime() + SESSION_LIFETIMES[session.audience].idleMs;
  return now.getTime() >= session.expiresAt.getTime() || now.getTime() >= idleDeadline;
}
