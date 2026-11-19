import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { mockSites } from '@/shared/sites/mocks/sites';
import { DEFAULT_SITE_LIST_QUERY } from '../../lib/siteList';
import { siteEntry } from '../../mocks/siteEntries';
import { SiteList, VIRTUALIZE_FROM } from './SiteList';

/** `count` sites, named apart. */
function manySites(count: number) {
  const base = mockSites[0];
  if (!base) throw new Error('No mocked site');
  return Array.from({ length: count }, (_, index) =>
    siteEntry({ ...base, id: `x${index}`, name: `Site ${String(index).padStart(3, '0')}` }, 1, 0),
  );
}

function renderList(count: number, query = DEFAULT_SITE_LIST_QUERY) {
  render(
    <SiteList
      entries={manySites(count)}
      query={query}
      onQueryChange={vi.fn()}
      selectedId={null}
      onSelect={vi.fn()}
      onHighlight={vi.fn()}
      onPlace={vi.fn()}
    />,
  );
  return within(screen.getByRole('region', { name: 'Liste de mes sites' }));
}

describe('SiteList', () => {
  it('renders every row up to the threshold', () => {
    expect(renderList(VIRTUALIZE_FROM).getAllByRole('listitem')).toHaveLength(VIRTUALIZE_FROM);
  });

  it('renders only the rows in view beyond, and counts them all', () => {
    const list = renderList(500);
    // jsdom has no layout: no height, only the overscan rows.
    expect(list.getAllByRole('listitem').length).toBeLessThan(20);
    expect(list.getByText(/sur/).textContent).toBe('500 sur 500 sites');
  });

  it('keeps « À compléter » while on, even once every site is placed', () => {
    // Every generated site has a position: nothing left to complete.
    const list = renderList(3, { ...DEFAULT_SITE_LIST_QUERY, toComplete: true });
    const toggle = list.getByRole('button', { name: /À compléter/ });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
  });

  it('hides « À compléter » when off and nothing is left to complete', () => {
    const list = renderList(3);
    expect(list.queryByRole('button', { name: /À compléter/ })).toBeNull();
  });
});
