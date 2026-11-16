import { describe, expect, it } from 'vitest';
import { backToLogHref, diveDetailPath, forwardLinkState, toDetailLinkState } from './backLink';

describe('back link to the dive log', () => {
  it('goes back to the list with the selection the user left', () => {
    expect(backToLogHref(toDetailLinkState('?region=corse&page=2'))).toBe(
      '/dives?region=corse&page=2',
    );
  });

  it('falls back to /dives on a direct access or an unexpected state', () => {
    expect(backToLogHref(null)).toBe('/dives');
    expect(backToLogHref(undefined)).toBe('/dives');
    expect(backToLogHref({ logSearch: 42 })).toBe('/dives');
    expect(backToLogHref({ logSearch: '//evil.example' })).toBe('/dives');
    expect(backToLogHref(toDetailLinkState(''))).toBe('/dives');
  });

  it('keeps the selection when paging to a neighbour', () => {
    expect(forwardLinkState({ logSearch: '?sort=-depth' })).toStrictEqual({
      logSearch: '?sort=-depth',
    });
    expect(forwardLinkState(null)).toStrictEqual({ logSearch: '' });
  });

  it('builds the detail path, the id as one segment', () => {
    expect(diveDetailPath('d127')).toBe('/dives/d127');
    expect(diveDetailPath('a/b')).toBe('/dives/a%2Fb');
  });
});
