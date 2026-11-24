import type { SessionAudience } from './session-audiences';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Expiry rules of a session audience (D33, D42). Configured in code, never stored. */
export interface SessionLifetime {
  /** Without activity for this long (measured on `last_seen_at`), the session is over. */
  readonly idleMs: number;
  /** Longest absolute lifetime (`expires_at - created_at`). */
  readonly absoluteMs: number;
  /** `last_seen_at` is written at most once per interval (the idle expiry is that coarse). */
  readonly touchIntervalMs: number;
}

export const SESSION_LIFETIMES = {
  // Long for the offline PWA (D22): 30 days of inactivity, 180 days at most.
  web: { idleMs: 30 * DAY_MS, absoluteMs: 180 * DAY_MS, touchIntervalMs: HOUR_MS },
  // Staff: 30 minutes of inactivity, 8 hours at most.
  admin: { idleMs: 30 * MINUTE_MS, absoluteMs: 8 * HOUR_MS, touchIntervalMs: MINUTE_MS },
} as const satisfies Record<SessionAudience, SessionLifetime>;

/**
 * Absolute lifetime of a web session without « Rester connecté » (D33): 24 h, browser-session
 * cookie. Its idle window stays the web one (30 days), which can never be reached first: no column
 * is needed to tell a short session from a long one. When it must be known (cookie `Max-Age` of a
 * rotated session), it is derived from the lifetime: `expires_at - created_at` ≤ 24 h.
 */
export const WEB_SHORT_SESSION_ABSOLUTE_MS = DAY_MS;

/** Absolute lifetime of a new session. `rememberMe` only matters on the web (no choice for staff). */
export function absoluteLifetimeMs(audience: SessionAudience, rememberMe: boolean): number {
  if (audience === 'web' && !rememberMe) {
    return WEB_SHORT_SESSION_ABSOLUTE_MS;
  }
  return SESSION_LIFETIMES[audience].absoluteMs;
}

/** True when the cookie must be persistent (`Max-Age`): a long web session. */
export function isPersistentSession(
  audience: SessionAudience,
  createdAt: Date,
  expiresAt: Date,
): boolean {
  return (
    audience === 'web' && expiresAt.getTime() - createdAt.getTime() > WEB_SHORT_SESSION_ABSOLUTE_MS
  );
}
