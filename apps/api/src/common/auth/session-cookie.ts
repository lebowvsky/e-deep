import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import type { AppConfigService } from '../../config/app-config.service';
import type { SessionAudience } from '../../modules/auth/session-audiences';
import type { IssuedSession } from '../../modules/auth/session.service';
import { CLOCK, type Clock } from '../time/clock';

/**
 * Cookie names per audience (D34). With `SESSION_COOKIE_SECURE` (production), the `__Host-` prefix
 * makes the browser require `Secure`, `Path=/` and no `Domain`. Without it (local http), the
 * prefix is dropped (a browser refuses a `__Host-` cookie without `Secure`); the web and admin
 * names stay distinct because localhost shares cookies across ports.
 */
export const SESSION_COOKIE_NAMES = {
  secure: { web: '__Host-edeep_sid', admin: '__Host-edeep_admin_sid' },
  insecure: { web: 'edeep_sid', admin: 'edeep_admin_sid' },
} as const satisfies Record<'secure' | 'insecure', Record<SessionAudience, string>>;

/**
 * Most distinct session tokens taken from one request (logout, login rotation): each costs a
 * query, and a browser holds one cookie per name. A forged header cannot multiply the work.
 */
export const MAX_PRESENTED_SESSION_TOKENS = 4;

export function sessionCookieName(audience: SessionAudience, secure: boolean): string {
  return SESSION_COOKIE_NAMES[secure ? 'secure' : 'insecure'][audience];
}

/**
 * Values of every cookie called `name` in a `Cookie` request header (RFC 6265 §5.4: `a=1; b=2`),
 * in header order, duplicates included. Native parsing, no `cookie-parser`: pairs without `=` are
 * ignored, names are compared exactly, a value is trimmed and unquoted but never URL-decoded (a
 * session token is base64url; anything else simply fails the token format downstream).
 */
export function readCookieValues(header: string | undefined, name: string): string[] {
  if (header === undefined) {
    return [];
  }
  const values: string[] = [];
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1 || pair.slice(0, separator).trim() !== name) {
      continue;
    }
    values.push(unquote(pair.slice(separator + 1).trim()));
  }
  return values;
}

function unquote(value: string): string {
  return value.length >= 2 && value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value;
}

/** Distinct non-empty values, first ones first, at most `limit`. */
function distinctTokens(values: readonly string[], limit: number): string[] {
  return [...new Set(values.filter((value) => value !== ''))].slice(0, limit);
}

/**
 * Reads and writes the session cookies (D33, D34): always `HttpOnly`, `SameSite=Strict`, `Path=/`,
 * no `Domain`, `Secure` per `SESSION_COOKIE_SECURE`. A persistent session gets a `Max-Age` (whole
 * seconds to its absolute expiry), any other a browser-session cookie without `Max-Age`.
 *
 * The token is read here only: handlers and services never see the `Cookie` header. It is never
 * logged.
 */
@Injectable()
export class SessionCookies {
  private readonly secure: boolean;

  constructor(
    @Inject(ConfigService) config: AppConfigService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.secure = config.get('SESSION_COOKIE_SECURE', { infer: true });
  }

  /**
   * The session token of `audience` presented by the request; `null` when there is none, or when
   * several different ones are presented: an ambiguous identity is no identity.
   */
  token(request: Request, audience: SessionAudience): string | null {
    const tokens = this.presentedTokens(request, audience);
    return tokens.length === 1 ? (tokens[0] ?? null) : null;
  }

  /** Every distinct token of `audience` presented (bounded), to end them all (logout, rotation). */
  presentedTokens(request: Request, audience: SessionAudience): string[] {
    const values = readCookieValues(request.headers.cookie, this.nameOf(audience));
    return distinctTokens(values, MAX_PRESENTED_SESSION_TOKENS);
  }

  /**
   * Whether the request presents any cookie of `audience`, under either naming convention
   * (`__Host-` or not) and even empty: the `DEV_AUTH_STUB` fallback never applies then.
   */
  presentsAnyCookie(request: Request, audience: SessionAudience): boolean {
    return [true, false].some(
      (secure) =>
        readCookieValues(request.headers.cookie, sessionCookieName(audience, secure)).length > 0,
    );
  }

  write(response: Response, audience: SessionAudience, session: IssuedSession): void {
    const options = this.baseOptions();
    if (session.persistent) {
      const seconds = Math.floor((session.expiresAt.getTime() - this.clock.now().getTime()) / 1000);
      // Express takes milliseconds and writes `Max-Age` in whole seconds (plus `Expires`).
      options.maxAge = Math.max(0, seconds) * 1000;
    }
    response.cookie(this.nameOf(audience), session.token, options);
  }

  /** Same name and attributes as `write`, so the browser replaces the cookie it holds. */
  clear(response: Response, audience: SessionAudience): void {
    response.clearCookie(this.nameOf(audience), this.baseOptions());
  }

  private nameOf(audience: SessionAudience): string {
    return sessionCookieName(audience, this.secure);
  }

  private baseOptions(): CookieOptions {
    return { httpOnly: true, sameSite: 'strict', path: '/', secure: this.secure };
  }
}
