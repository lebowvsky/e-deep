import { describe, expect, it } from 'vitest';
import { parseApiBaseUrl } from './apiBaseUrl';

const origin = 'http://localhost:5173';

describe('parseApiBaseUrl', () => {
  it('resolves a path against the origin', () => {
    expect(parseApiBaseUrl('/api', origin)).toBe('http://localhost:5173/api');
  });

  it.each(['http://localhost:3000/api', 'https://api.example.test/api'])(
    'keeps the absolute http(s) URL %s unchanged',
    (value) => {
      expect(parseApiBaseUrl(value, origin)).toBe(value);
    },
  );

  // `\t`, `\n` and `\r` are stripped by the URL parser: `/\t/evil.com` becomes `//evil.com`.
  it.each(['//evil.com', '/\\evil.com', '/\t/evil.com', '/\n/evil.com', '/\r\\evil.com'])(
    'refuses the path %j that leaves the front origin',
    (value) => {
      expect(() => parseApiBaseUrl(value, origin)).toThrow(/does not resolve to the front origin/);
    },
  );

  it.each(['', undefined])('refuses a missing value (%j)', (value) => {
    expect(() => parseApiBaseUrl(value, origin)).toThrow(/is not defined/);
  });

  it.each(['not a url', 'javascript:alert(1)', 'file:///etc/passwd', 'ftp://example.test/api'])(
    'refuses %j, which is neither a path nor an absolute http(s) URL',
    (value) => {
      expect(() => parseApiBaseUrl(value, origin)).toThrow(/neither a path/);
    },
  );

  it('never echoes the value in its message', () => {
    expect(() => parseApiBaseUrl('javascript:alert(1)', origin)).not.toThrow(/alert/);
  });
});
