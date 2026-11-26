import { describe, expect, it } from 'vitest';
import { DEFAULT_NEXT, loginPath, MAX_NEXT_LENGTH, pathOf, safeNext } from './safeNext';

describe('safeNext', () => {
  it.each(['/', '/accounts', '/accounts/a1?tab=sessions#log', '/health?refresh=1'])(
    'keeps the internal path %s',
    (path) => {
      expect(safeNext(path)).toBe(path);
    },
  );

  it.each([
    ['nothing', null],
    ['undefined', undefined],
    ['an empty value', ''],
    ['a protocol-relative URL', '//evil.com'],
    ['a protocol-relative URL with a path', '//evil.com/accounts'],
    ['a backslash host', '/\\evil.com'],
    ['a backslash further on', '/a\\..\\evil'],
    ['an https URL', 'https://evil.com/'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a relative path', 'accounts'],
    ['a tab hiding a second slash', '/\t/evil.com'],
    ['a newline', '/accounts\n'],
    ['a NUL', '/accounts\u0000'],
    ['a DEL', '/accounts\u007f'],
    ['a dot segment hiding a second slash', '/.//evil.com'],
    ['a parent segment hiding a second slash', '/a/..//evil.com'],
    ['the login page', '/login?next=%2Faccounts'],
    ['the logout page', '/logout'],
    ['the forbidden page', '/forbidden'],
    ['a very long value', `/a?q=${'a'.repeat(MAX_NEXT_LENGTH)}`],
  ])('falls back to the home page for %s', (_label, value) => {
    expect(safeNext(value)).toBe(DEFAULT_NEXT);
  });

  it.each([
    ['an encoded parent segment hiding a second slash', '/%2e%2e//evil.com'],
    ['an encoded parent segment further on', '/a/%2e%2e//evil'],
    ['a mixed parent segment', '/.%2e//evil'],
  ])('falls back to the home page for %s', (_label, value) => {
    expect(safeNext(value)).toBe(DEFAULT_NEXT);
  });

  // Encoded slashes and backslashes are not decoded by URL parsers: they stay in one segment.
  it.each([
    ['/%2F%2Fevil.com', '/%2F%2Fevil.com'],
    ['/%5Cevil.com', '/%5Cevil.com'],
    ['/%2e%2e/%2fevil.com', '/%2fevil.com'],
  ])('keeps %s an internal path', (value, expected) => {
    const next = safeNext(value);
    expect(next).toBe(expected);
    expect(new URL(next, 'http://admin.test').origin).toBe('http://admin.test');
  });

  it('returns the normalised path', () => {
    expect(safeNext('/a/../accounts/./a1?x=1#n')).toBe('/accounts/a1?x=1#n');
  });

  it('keeps a page whose name only starts like a session page', () => {
    expect(safeNext('/logins')).toBe('/logins');
  });

  it('defaults to the home page', () => {
    expect(DEFAULT_NEXT).toBe('/');
  });
});

describe('loginPath', () => {
  it('carries the page left in `next`', () => {
    expect(loginPath('/accounts?tab=1')).toBe('/login?next=%2Faccounts%3Ftab%3D1');
  });

  it('carries nothing for the home page', () => {
    expect(loginPath('/')).toBe('/login');
  });
});

describe('pathOf', () => {
  it('keeps the path, query and hash of a URL', () => {
    expect(pathOf('http://admin.test/accounts?tab=1#log')).toBe('/accounts?tab=1#log');
  });
});
