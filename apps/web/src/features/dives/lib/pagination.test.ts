import { describe, expect, it } from 'vitest';
import { pageItems } from './pagination';

describe('pageItems', () => {
  it('matches the mockup on page 1 of 13', () => {
    expect(pageItems(1, 13)).toEqual([1, 2, 3, 'gap', 13]);
  });

  it('shows the neighbours of a page in the middle', () => {
    expect(pageItems(7, 13)).toEqual([1, 'gap', 6, 7, 8, 'gap', 13]);
  });

  it('keeps 3 pages at the end and never hides a single page behind « … »', () => {
    expect(pageItems(13, 13)).toEqual([1, 'gap', 11, 12, 13]);
    expect(pageItems(4, 13)).toEqual([1, 2, 3, 4, 5, 'gap', 13]);
  });

  it('handles short lists', () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(2, 3)).toEqual([1, 2, 3]);
  });
});
