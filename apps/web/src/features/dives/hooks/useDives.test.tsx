import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import { TestProviders } from '@/test/TestProviders';
import { DEFAULT_QUERY } from '../lib/query';
import { mockDiveLogResponse, mockOwner } from '../mocks/diveLogResponse';
import type { DivesQuery } from '../types';
import { useDives } from './useDives';

const now = new Date(2026, 3, 10);

const at = (path: string, get: ApiClient['get']) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TestProviders client={{ get }}>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </TestProviders>
    );
  };

const render = (query: DivesQuery, path: string, get: ApiClient['get']) =>
  renderHook(() => useDives(query, now, mockOwner), { wrapper: at(path, get) });

describe('useDives', () => {
  it.each(['loading', 'empty', 'error'] as const)(
    'forces the %s state with ?state= in dev, without calling the API',
    (state) => {
      const get = vi.fn();
      const { result } = render(DEFAULT_QUERY, `/dives?state=${state}`, get);
      expect(result.current.status).toBe(state);
      expect(get).not.toHaveBeenCalled();
    },
  );

  it('loads the log, then gives the page, the total and the summary of the selection', async () => {
    const get = vi.fn().mockResolvedValue(mockDiveLogResponse);
    const query: DivesQuery = { ...DEFAULT_QUERY, regions: ['corse'], size: 20 };
    const { result } = render(query, '/dives', get);

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    if (result.current.status !== 'ready') return;

    expect(get).toHaveBeenCalledWith('dives', expect.any(Function), {
      signal: expect.any(AbortSignal) as unknown,
    });
    expect(result.current.total).toBe(31);
    expect(result.current.items).toHaveLength(20);
    expect(result.current.summary.count).toBe(31);
    expect(result.current.log.totalDives).toBe(127);
    expect(result.current.facets.regions[1]).toEqual({ key: 'corse', name: 'Corse', count: 31 });
    expect(result.current.count({ ...query, with: ['b1'], depthMin: 20, depthMax: 40 })).toBe(9);
  });

  it('is empty when the log has no dive', async () => {
    const { result } = render(DEFAULT_QUERY, '/dives', vi.fn().mockResolvedValue({ dives: [] }));
    await waitFor(() => expect(result.current.status).toBe('empty'));
  });

  it('reports an error, then recovers on retry', async () => {
    // The second attempt settles on demand, so that its loading state can be observed.
    let release: (body: unknown) => void = () => undefined;
    const second = new Promise((resolve) => {
      release = resolve;
    });
    const get = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('network', 'The API is unreachable.'))
      .mockReturnValueOnce(second);
    const { result } = render(DEFAULT_QUERY, '/dives', get);

    await waitFor(() => expect(result.current.status).toBe('error'));
    const state = result.current;
    if (state.status !== 'error') throw new Error('Expected the error state');
    act(() => state.retry());

    await waitFor(() => expect(result.current.status).toBe('loading'));
    release(mockDiveLogResponse);
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(get).toHaveBeenCalledTimes(2);
  });
});
