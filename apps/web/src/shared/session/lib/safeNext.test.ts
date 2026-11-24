import { describe, expect, it } from 'vitest';
import { DEFAULT_NEXT, MAX_NEXT_LENGTH, safeNext } from './safeNext';

describe('safeNext', () => {
  it.each(['/dives', '/dives/d127?from=log#notes', '/sites/s1', '/dashboard?state=empty'])(
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
    ['a protocol-relative URL with a path', '//evil.com/dashboard'],
    ['a backslash host', '/\\evil.com'],
    ['a backslash further on', '/dives\\..\\evil'],
    ['an https URL', 'https://evil.com/dashboard'],
    ['an http URL', 'http://evil.com'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a relative path', 'dives'],
    ['a tab hiding a second slash', '/\t/evil.com'],
    ['a newline', '/dives\n'],
    ['a NUL', '/dives\u0000'],
    ['a DEL', '/dives\u007f'],
    ['a dot segment hiding a second slash', '/.//evil.com'],
    ['a parent segment hiding a second slash', '/a/..//evil.com'],
    ['the login page', '/login?next=%2Fdives'],
    ['the logout page', '/logout'],
    ['the sign-up page', '/signup'],
    ['an onboarding page', '/welcome'],
    ['the consent page', '/consent'],
    ['a very long value', `/dives?q=${'a'.repeat(MAX_NEXT_LENGTH)}`],
  ])('falls back to the dashboard for %s', (_label, value) => {
    expect(safeNext(value)).toBe(DEFAULT_NEXT);
  });

  it('returns the normalised path', () => {
    expect(safeNext('/a/../dives/./d127?x=1#n')).toBe('/dives/d127?x=1#n');
  });

  it('keeps encoded slashes as a plain path of the app', () => {
    expect(safeNext('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com');
  });

  it('keeps a page whose name only starts like a session page', () => {
    expect(safeNext('/logbook')).toBe('/logbook');
  });

  it('accepts a value of the maximum length', () => {
    const path = `/dives?q=${'a'.repeat(MAX_NEXT_LENGTH - '/dives?q='.length)}`;
    expect(safeNext(path)).toBe(path);
  });

  it('defaults to the dashboard', () => {
    expect(DEFAULT_NEXT).toBe('/dashboard');
  });
});
