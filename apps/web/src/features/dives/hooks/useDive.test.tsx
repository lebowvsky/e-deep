import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  type ApiClient,
  type RequestOptions,
  type TypeGuard,
} from '@/shared/lib/apiClient';
import { ApiClientContext } from '@/shared/lib/apiClientContext';
import { createQueryClient } from '@/shared/lib/queryClient';
import { TestProviders } from '@/test/TestProviders';
import { mockDiveDetail } from '../mocks/diveDetailResponse';
import { mockDiveLogResponse, mockOwner } from '../mocks/diveLogResponse';
import type { DiveDetailState } from '../types';
import { useDive } from './useDive';

const DIVE_ID = 'd100';
const LOG_PATH = 'dives';
const DETAIL_PATH = `dives/${DIVE_ID}`;

const http = (status: number) =>
  new ApiError('http', `The API answered with HTTP ${status}.`, { status });
const networkError = () => new ApiError('network', 'The API is unreachable.');

type Outcome = () => Promise<unknown>;

/**
 * A fake client that answers by path: the detail and the log are two requests. Each path takes a
 * list of outcomes, one per call (the last one repeats).
 */
function fakeClient(routes: Record<string, Outcome[]>) {
  const requests: { path: string; options: RequestOptions | undefined }[] = [];
  async function get<T>(path: string, guard: TypeGuard<T>, options?: RequestOptions): Promise<T> {
    const outcomes = routes[path] ?? [];
    const outcome = outcomes[Math.min(callsTo(path), outcomes.length - 1)];
    requests.push({ path, options });
    if (!outcome) throw new Error(`Unexpected request ${path}`);
    const body = await outcome();
    if (!guard(body)) throw new Error(`The mocked ${path} breaks the contract`);
    return body;
  }
  function callsTo(path: string): number {
    return requests.filter((request) => request.path === path).length;
  }
  return { get, requests, callsTo };
}

const resolve =
  (body: unknown): Outcome =>
  () =>
    Promise.resolve(body);
const reject =
  (error: Error): Outcome =>
  () =>
    Promise.reject(error);
/** An outcome that settles on demand, so that the state in between can be observed. */
function deferred(): { outcome: Outcome; release: (body: unknown) => void } {
  let release: (body: unknown) => void = () => undefined;
  const pending = new Promise((done) => {
    release = done;
  });
  return { outcome: () => pending, release };
}

const render = (get: ApiClient['get'], path = `/dives/${DIVE_ID}`) =>
  renderHook(() => useDive(DIVE_ID, mockOwner), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <TestProviders client={{ get }}>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </TestProviders>
    ),
  });

type ReadyState = Extract<DiveDetailState, { status: 'ready' }>;

function ready(state: DiveDetailState): ReadyState {
  if (state.status !== 'ready') throw new Error(`Expected the ready state, got ${state.status}`);
  return state;
}

describe('useDive', () => {
  it.each(['loading', 'not-found', 'error'] as const)(
    'forces the %s state with ?state= in dev, without calling the API',
    (state) => {
      const { get, requests } = fakeClient({});
      const { result } = render(get, `/dives/${DIVE_ID}?state=${state}`);
      expect(result.current.status).toBe(state);
      expect(requests).toHaveLength(0);
    },
  );

  it('has no preview when the loading state is forced', () => {
    const { get } = fakeClient({});
    const { result } = render(get, `/dives/${DIVE_ID}?state=loading`);
    expect(result.current).toStrictEqual({ status: 'loading', preview: null });
  });

  it('loads the detail with a cancellable request, then gives the dive and its log insights', async () => {
    const { get, requests } = fakeClient({
      [DETAIL_PATH]: [resolve(mockDiveDetail(DIVE_ID))],
      [LOG_PATH]: [resolve(mockDiveLogResponse)],
    });
    const { result } = render(get);

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(ready(result.current).insights).not.toBeNull());
    const { dive, insights } = ready(result.current);

    const detailRequest = requests.find((request) => request.path === DETAIL_PATH);
    expect(detailRequest?.options?.signal).toBeInstanceOf(AbortSignal);
    expect(dive.number).toBe(100);
    expect(dive.site.latitude).toBe(42.58);
    expect(dive.team[0]?.isSelf).toBe(true);
    expect(insights?.previous?.number).toBe(99);
    expect(insights?.next?.number).toBe(101);
  });

  it('previews the header from the log while the detail loads', async () => {
    const detail = deferred();
    const { get } = fakeClient({
      [DETAIL_PATH]: [detail.outcome],
      [LOG_PATH]: [resolve(mockDiveLogResponse)],
    });
    const { result } = render(get);

    await waitFor(() => {
      const state = result.current;
      if (state.status !== 'loading') throw new Error('Expected the loading state');
      expect(state.preview?.number).toBe(100);
    });
    detail.release(mockDiveDetail(DIVE_ID));
    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('shows the dive without insights while the log is pending or when it failed', async () => {
    const log = deferred();
    const { get } = fakeClient({
      [DETAIL_PATH]: [resolve(mockDiveDetail(DIVE_ID))],
      [LOG_PATH]: [log.outcome],
    });
    const { result } = render(get);

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(ready(result.current).insights).toBeNull();

    const failing = fakeClient({
      [DETAIL_PATH]: [resolve(mockDiveDetail(DIVE_ID))],
      [LOG_PATH]: [reject(networkError())],
    });
    const second = render(failing.get);
    await waitFor(() => expect(failing.callsTo(LOG_PATH)).toBe(1));
    await waitFor(() => expect(second.result.current.status).toBe('ready'));
    expect(ready(second.result.current).insights).toBeNull();
  });

  it.each([
    ['a 404 (unknown or another diver’s dive)', 404],
    ['a 400 (malformed id)', 400],
  ])('is not-found on %s, which is not an error', async (_label, status) => {
    const { get } = fakeClient({
      [DETAIL_PATH]: [reject(http(status))],
      [LOG_PATH]: [resolve(mockDiveLogResponse)],
    });
    const { result } = render(get);
    await waitFor(() => expect(result.current).toStrictEqual({ status: 'not-found' }));
  });

  it('reports an error, then recovers on retry', async () => {
    const second = deferred();
    const { get, callsTo } = fakeClient({
      [DETAIL_PATH]: [reject(http(500)), second.outcome],
      [LOG_PATH]: [resolve(mockDiveLogResponse)],
    });
    const { result } = render(get);

    await waitFor(() => expect(result.current.status).toBe('error'));
    const state = result.current;
    if (state.status !== 'error') throw new Error('Expected the error state');
    act(() => state.retry());

    await waitFor(() => expect(result.current.status).toBe('loading'));
    second.release(mockDiveDetail(DIVE_ID));
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(callsTo(DETAIL_PATH)).toBe(2);
  });
});

describe('useDive with the app retry policy', () => {
  // Retry delay of TanStack Query (1 s for the first retry), with some margin.
  const RETRY_WINDOW_MS = 5_000;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mount(get: ApiClient['get']) {
    const queryClient = createQueryClient();
    return renderHook(() => useDive(DIVE_ID, mockOwner), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <ApiClientContext value={{ get }}>
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={[`/dives/${DIVE_ID}`]}>{children}</MemoryRouter>
          </QueryClientProvider>
        </ApiClientContext>
      ),
    });
  }

  const elapse = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

  it('never retries a 404: not-found at once, a single request', async () => {
    const { get, callsTo } = fakeClient({
      [DETAIL_PATH]: [reject(http(404))],
      [LOG_PATH]: [resolve(mockDiveLogResponse)],
    });
    const { result } = mount(get);

    await elapse(0);
    expect(result.current.status).toBe('not-found');
    await elapse(RETRY_WINDOW_MS);
    expect(callsTo(DETAIL_PATH)).toBe(1);
  });

  it('retries a network failure once, staying in the loading state, then shows the dive', async () => {
    const { get, callsTo } = fakeClient({
      [DETAIL_PATH]: [reject(networkError()), resolve(mockDiveDetail(DIVE_ID))],
      [LOG_PATH]: [resolve(mockDiveLogResponse)],
    });
    const { result } = mount(get);

    await elapse(0);
    expect(result.current.status).toBe('loading');
    await elapse(RETRY_WINDOW_MS);
    expect(result.current.status).toBe('ready');
    expect(callsTo(DETAIL_PATH)).toBe(2);
  });
});
