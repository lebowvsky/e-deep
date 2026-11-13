import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import { ApiClientContext } from '@/shared/lib/apiClientContext';
import { createQueryClient } from '@/shared/lib/queryClient';
import { TestProviders } from '@/test/TestProviders';
import { divesKeys } from '../api/queryKeys';
import { DEFAULT_QUERY } from '../lib/query';
import { mockDiveLogResponse, mockOwner } from '../mocks/diveLogResponse';
import type { DivesQuery, DivesState } from '../types';
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

type ReadyState = Extract<DivesState, { status: 'ready' }>;

function ready(state: DivesState): ReadyState {
  if (state.status !== 'ready') throw new Error(`Expected the ready state, got ${state.status}`);
  return state;
}

/** The items of a ready state, never empty: `every` over an empty list would prove nothing. */
function items(state: DivesState): ReadyState['items'] {
  const { items: list } = ready(state);
  expect(list.length).toBeGreaterThan(0);
  return list;
}

const networkError = () => new ApiError('network', 'The API is unreachable.');

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
    const state = ready(result.current);

    expect(get).toHaveBeenCalledWith('dives', expect.any(Function), {
      signal: expect.any(AbortSignal) as unknown,
    });
    expect(state.total).toBe(31);
    expect(state.items).toHaveLength(20);
    expect(state.summary.count).toBe(31);
    expect(state.log.totalDives).toBe(127);
    expect(state.facets.regions[1]).toStrictEqual({ key: 'corse', name: 'Corse', count: 31 });
    expect(state.count({ ...query, with: ['b1'], depthMin: 20, depthMax: 40 })).toBe(9);
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
    const get = vi.fn().mockRejectedValueOnce(networkError()).mockReturnValueOnce(second);
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

  it('changes page from the cached log, without calling the API again', async () => {
    const get = vi.fn().mockResolvedValue(mockDiveLogResponse);
    const { result, rerender } = renderHook(
      ({ query }: { query: DivesQuery }) => useDives(query, now, mockOwner),
      { wrapper: at('/dives', get), initialProps: { query: DEFAULT_QUERY } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const firstPage = items(result.current).map((dive) => dive.id);
    expect(firstPage[0]).toBe('d127');

    rerender({ query: { ...DEFAULT_QUERY, page: 2 } });
    const secondPage = items(result.current).map((dive) => dive.id);
    expect(secondPage).toHaveLength(DEFAULT_QUERY.size);
    // The next dives, latest first: page 2 starts right after the last one of page 1.
    expect(Number(secondPage[0]?.slice(1))).toBe(127 - DEFAULT_QUERY.size);
    expect(secondPage.some((id) => firstPage.includes(id))).toBe(false);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('filters the cached log client side, without calling the API again', async () => {
    const get = vi.fn().mockResolvedValue(mockDiveLogResponse);
    const { result, rerender } = renderHook(
      ({ query }: { query: DivesQuery }) => useDives(query, now, mockOwner),
      { wrapper: at('/dives', get), initialProps: { query: DEFAULT_QUERY } },
    );
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(ready(result.current).total).toBe(127);

    rerender({ query: { ...DEFAULT_QUERY, regions: ['corse'] } });
    expect(ready(result.current).total).toBe(31);
    expect(items(result.current).every((dive) => dive.site.region === 'corse')).toBe(true);
    // The log overview does not depend on the filters.
    expect(ready(result.current).log.totalDives).toBe(127);

    rerender({ query: { ...DEFAULT_QUERY, gases: ['nitrox'], depthMin: 30 } });
    expect(
      items(result.current).every(
        (dive) => dive.gasMix.startsWith('NITROX') && dive.depthMaxM >= 30,
      ),
    ).toBe(true);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('puts the owner first in every team, as the user', async () => {
    const get = vi.fn().mockResolvedValue(mockDiveLogResponse);
    const { result } = render(DEFAULT_QUERY, '/dives', get);
    await waitFor(() => expect(result.current.status).toBe('ready'));

    for (const dive of items(result.current)) {
      expect(dive.team[0]).toMatchObject({ id: mockOwner.id, isSelf: true });
    }
  });
});

/**
 * With the query client of the app (retry policy, stale time), not the no-retry one of
 * `TestProviders`. The retry waits for TanStack's default delay (1 s for the first one): the
 * clock is faked and driven by hand, so these tests stay instant and deterministic.
 */
describe('useDives with the app query client', () => {
  /** Longer than any retry delay of a single retry, shorter than the stale time (60 s). */
  const RETRY_WINDOW_MS = 5_000;
  const STALE_TIME_MS = 60_000;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(get: ApiClient['get']) {
    const queryClient: QueryClient = createQueryClient();
    function Wrapper({ children }: { children: ReactNode }) {
      return (
        <ApiClientContext value={{ get }}>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/dives']}>{children}</MemoryRouter>
          </QueryClientProvider>
        </ApiClientContext>
      );
    }
    const mount = () =>
      renderHook(() => useDives(DEFAULT_QUERY, now, mockOwner), { wrapper: Wrapper });
    return { queryClient, mount };
  }

  /** Lets the pending requests settle and the timers (retry delay) run, inside `act`. */
  const elapse = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

  it('retries a network failure once, staying in the loading state, then shows the log', async () => {
    const get = vi
      .fn()
      .mockRejectedValueOnce(networkError())
      .mockResolvedValueOnce(mockDiveLogResponse);
    const { result } = setup(get).mount();

    await elapse(0);
    expect(get).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('loading');

    await elapse(RETRY_WINDOW_MS);
    expect(ready(result.current).total).toBe(127);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('shows the error after a failed retry, and does not try a third time', async () => {
    const get = vi.fn().mockRejectedValue(networkError());
    const { result } = setup(get).mount();

    await elapse(RETRY_WINDOW_MS);
    expect(result.current.status).toBe('error');
    expect(get).toHaveBeenCalledTimes(2);

    await elapse(STALE_TIME_MS);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['an HTTP 404', new ApiError('http', 'The API answered with HTTP 404.', { status: 404 })],
    ['an invalid response', new ApiError('invalid-response', 'Unexpected response shape.')],
  ])('shows the error at once, without retrying, on %s', async (_label, error) => {
    const get = vi.fn().mockRejectedValue(error);
    const { result } = setup(get).mount();

    await elapse(0);
    expect(result.current.status).toBe('error');
    expect(get).toHaveBeenCalledTimes(1);

    await elapse(RETRY_WINDOW_MS);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('reuses the cache when mounted again within the stale time', async () => {
    const get = vi.fn().mockResolvedValue(mockDiveLogResponse);
    const { mount } = setup(get);

    const first = mount();
    await elapse(0);
    expect(first.result.current.status).toBe('ready');
    first.unmount();

    await elapse(STALE_TIME_MS / 2);
    const second = mount();
    // Straight from the cache: no loading state, no second request.
    expect(ready(second.result.current).total).toBe(127);
    await elapse(RETRY_WINDOW_MS);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('keeps showing the cached log when a background refetch fails', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(mockDiveLogResponse)
      .mockRejectedValue(networkError());
    const { queryClient, mount } = setup(get);

    const first = mount();
    await elapse(0);
    expect(first.result.current.status).toBe('ready');
    first.unmount();

    // Stale by now: mounting again shows the cache at once and refetches in the background.
    await elapse(STALE_TIME_MS + 1);
    const second = mount();
    expect(ready(second.result.current).total).toBe(127);

    await elapse(RETRY_WINDOW_MS);
    // The refetch and its retry both failed…
    expect(get).toHaveBeenCalledTimes(3);
    expect(queryClient.getQueryState(divesKeys.log())?.status).toBe('error');
    // …but the log already loaded stays on screen: no error state over valid data.
    expect(ready(second.result.current).total).toBe(127);
  });
});
