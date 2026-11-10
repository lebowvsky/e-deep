import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { DEFAULT_QUERY } from '../lib/query';
import { useDives } from './useDives';

const at = (path: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };

describe('useDives', () => {
  it.each(['loading', 'empty', 'error'] as const)(
    'forces the %s state with ?state= in dev',
    (state) => {
      const { result } = renderHook(() => useDives(DEFAULT_QUERY), {
        wrapper: at(`/dives?state=${state}`),
      });
      expect(result.current.status).toBe(state);
    },
  );

  it('loads the log, then gives the page, the total and the summary of the selection', async () => {
    const query = { ...DEFAULT_QUERY, regions: ['corse' as const], size: 20 as const };
    const { result } = renderHook(() => useDives(query), { wrapper: at('/dives') });

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status !== 'ready') return;

    expect(result.current.total).toBe(31);
    expect(result.current.items).toHaveLength(20);
    expect(result.current.summary.count).toBe(31);
    expect(result.current.log.totalDives).toBe(127);
    expect(result.current.facets.regions.corse).toBe(31);
    expect(result.current.count({ ...query, with: ['b1'], depthMin: 20, depthMax: 40 })).toBe(9);
  });
});
