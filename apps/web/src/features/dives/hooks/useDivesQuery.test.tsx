import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useDivesQuery } from './useDivesQuery';

const at = (path: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };

function useQueryAndUrl() {
  const [query, update] = useDivesQuery();
  const { search } = useLocation();
  return { query, update, search };
}

describe('useDivesQuery', () => {
  it('reads the query from the URL', () => {
    const { result } = renderHook(useQueryAndUrl, { wrapper: at('/dives?region=corse&page=2') });
    expect(result.current.query).toMatchObject({ regions: ['corse'], page: 2 });
  });

  it('writes the changes into the URL and goes back to page 1 when a filter changes', () => {
    const { result } = renderHook(useQueryAndUrl, {
      wrapper: at('/dives?region=corse&page=3&state=loading'),
    });

    act(() => result.current.update({ depthMin: 20 }));
    expect(result.current.query).toMatchObject({ regions: ['corse'], depthMin: 20, page: 1 });
    expect(result.current.search).toBe('?state=loading&region=corse&depthMin=20');

    act(() => result.current.update({ page: 2 }));
    expect(result.current.search).toBe('?state=loading&region=corse&depthMin=20&page=2');
  });
});
