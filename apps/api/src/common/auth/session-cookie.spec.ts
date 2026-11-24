import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { AppConfigService } from '../../config/app-config.service';
import {
  MAX_PRESENTED_SESSION_TOKENS,
  SessionCookies,
  readCookieValues,
  sessionCookieName,
} from './session-cookie';

const TOKEN = 'a'.repeat(43);
const OTHER = 'b'.repeat(43);

describe('readCookieValues', () => {
  it('finds a cookie among several', () => {
    expect(readCookieValues(`theme=dark; edeep_sid=${TOKEN}; lang=fr`, 'edeep_sid')).toEqual([
      TOKEN,
    ]);
  });

  it('returns nothing without a header or without the cookie', () => {
    expect(readCookieValues(undefined, 'edeep_sid')).toEqual([]);
    expect(readCookieValues('', 'edeep_sid')).toEqual([]);
    expect(readCookieValues('theme=dark', 'edeep_sid')).toEqual([]);
  });

  it('keeps every value of a duplicated name, in order', () => {
    expect(readCookieValues(`edeep_sid=${TOKEN}; edeep_sid=${OTHER}`, 'edeep_sid')).toEqual([
      TOKEN,
      OTHER,
    ]);
  });

  it('ignores malformed pairs and tolerates spacing and quotes', () => {
    const header = `garbage; =orphan;edeep_sid ; edeep_sid = "${TOKEN}" ;;`;

    expect(readCookieValues(header, 'edeep_sid')).toEqual([TOKEN]);
  });

  it('compares names exactly: no prefix, suffix nor case match', () => {
    const header = `__Host-edeep_sid=${TOKEN}; edeep_sid_x=1; EDEEP_SID=2; edeep_admin_sid=3`;

    expect(readCookieValues(header, 'edeep_sid')).toEqual([]);
    expect(readCookieValues(header, '__Host-edeep_sid')).toEqual([TOKEN]);
  });

  it('keeps an empty value and never URL-decodes', () => {
    expect(readCookieValues('edeep_sid=; x=1', 'edeep_sid')).toEqual(['']);
    expect(readCookieValues('edeep_sid=a%3Db', 'edeep_sid')).toEqual(['a%3Db']);
  });
});

describe('sessionCookieName', () => {
  it.each([
    ['web', true, '__Host-edeep_sid'],
    ['admin', true, '__Host-edeep_admin_sid'],
    ['web', false, 'edeep_sid'],
    ['admin', false, 'edeep_admin_sid'],
  ] as const)('%s, secure=%s → %s', (audience, secure, name) => {
    expect(sessionCookieName(audience, secure)).toBe(name);
  });
});

describe('SessionCookies', () => {
  const now = new Date('2026-11-24T10:00:00.000Z');
  const cookies = (secure: boolean) =>
    new SessionCookies({ get: () => secure } as unknown as AppConfigService & ConfigService, {
      now: () => now,
    });
  const requestWith = (cookie: string | undefined) => ({ headers: { cookie } }) as Request;

  describe('token', () => {
    it('reads the single token of the audience', () => {
      expect(cookies(false).token(requestWith(`edeep_sid=${TOKEN}`), 'web')).toBe(TOKEN);
      expect(cookies(true).token(requestWith(`__Host-edeep_sid=${TOKEN}`), 'web')).toBe(TOKEN);
    });

    it('ignores the cookie of the other audience', () => {
      expect(cookies(false).token(requestWith(`edeep_admin_sid=${TOKEN}`), 'web')).toBeNull();
    });

    it('accepts the same token twice but refuses two different ones', () => {
      const service = cookies(false);

      expect(service.token(requestWith(`edeep_sid=${TOKEN}; edeep_sid=${TOKEN}`), 'web')).toBe(
        TOKEN,
      );
      expect(
        service.token(requestWith(`edeep_sid=${TOKEN}; edeep_sid=${OTHER}`), 'web'),
      ).toBeNull();
    });

    it('treats an empty value as no token', () => {
      expect(cookies(false).token(requestWith('edeep_sid='), 'web')).toBeNull();
    });
  });

  it('presentedTokens: distinct, non-empty and bounded', () => {
    const header = Array.from({ length: 10 }, (_, index) => `edeep_sid=t${index}`)
      .concat(['edeep_sid=t0', 'edeep_sid='])
      .join('; ');

    const tokens = cookies(false).presentedTokens(requestWith(header), 'web');

    expect(tokens).toHaveLength(MAX_PRESENTED_SESSION_TOKENS);
    expect(tokens).toEqual(['t0', 't1', 't2', 't3']);
  });

  describe('write and clear', () => {
    const response = () => {
      const calls: { method: string; name: string; options: unknown }[] = [];
      const fake = {
        cookie: (name: string, _value: string, options: unknown) =>
          calls.push({ method: 'cookie', name, options }),
        clearCookie: (name: string, options: unknown) =>
          calls.push({ method: 'clearCookie', name, options }),
      };
      return { calls, fake: fake as unknown as Response };
    };
    const persistent = {
      sessionId: 'session-1',
      token: TOKEN,
      expiresAt: new Date(now.getTime() + 90_500),
      persistent: true,
    };

    it('gives a persistent session a Max-Age in whole seconds to its expiry', () => {
      const { calls, fake } = response();

      cookies(true).write(fake, 'web', persistent);

      expect(calls).toEqual([
        {
          method: 'cookie',
          name: '__Host-edeep_sid',
          options: { httpOnly: true, sameSite: 'strict', path: '/', secure: true, maxAge: 90_000 },
        },
      ]);
    });

    it('writes a browser-session cookie without Max-Age otherwise', () => {
      const { calls, fake } = response();

      cookies(false).write(fake, 'admin', { ...persistent, persistent: false });

      expect(calls[0]).toEqual({
        method: 'cookie',
        name: 'edeep_admin_sid',
        options: { httpOnly: true, sameSite: 'strict', path: '/', secure: false },
      });
    });

    it('clears with the same name and attributes', () => {
      const { calls, fake } = response();

      cookies(true).clear(fake, 'admin');

      expect(calls[0]).toEqual({
        method: 'clearCookie',
        name: '__Host-edeep_admin_sid',
        options: { httpOnly: true, sameSite: 'strict', path: '/', secure: true },
      });
    });
  });
});
