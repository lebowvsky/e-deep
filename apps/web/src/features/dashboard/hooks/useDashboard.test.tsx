import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, type ApiClient } from '@/shared/lib/apiClient';
import { TestProviders } from '@/test/TestProviders';
import { dashboardResponse } from '../api/dashboardResponse.fixture';
import { useDashboard } from './useDashboard';

function fakeClient(get: ApiClient['get']): ApiClient {
  return { get };
}

const at = (path: string, client: ApiClient) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TestProviders client={client}>
        <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>
      </TestProviders>
    );
  };

describe('useDashboard', () => {
  it.each(['loading', 'empty', 'ready'] as const)(
    'forces the %s state with ?state= in dev, without calling the API',
    (state) => {
      const get = vi.fn();
      const { result } = renderHook(() => useDashboard(), {
        wrapper: at(`/dashboard?state=${state}`, fakeClient(get)),
      });
      expect(result.current.status).toBe(state);
      expect(get).not.toHaveBeenCalled();
    },
  );

  it('loads the dashboard from the API', async () => {
    const get = vi.fn().mockResolvedValue(dashboardResponse());
    const { result } = renderHook(() => useDashboard(), {
      wrapper: at('/dashboard', fakeClient(get)),
    });

    expect(result.current.status).toBe('loading');
    await vi.waitFor(() => expect(result.current.status).toBe('ready'));
    expect(get).toHaveBeenCalledWith('dashboard', expect.any(Function), {
      signal: expect.any(AbortSignal) as unknown,
    });
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
    const { result } = renderHook(() => useDashboard(), {
      wrapper: at('/dashboard', fakeClient(get)),
    });

    await vi.waitFor(() => expect(result.current.status).toBe('error'));
    const state = result.current;
    if (state.status !== 'error') throw new Error('Expected the error state');
    act(() => state.retry());

    await vi.waitFor(() => expect(result.current.status).toBe('loading'));
    release(dashboardResponse());
    await vi.waitFor(() => expect(result.current.status).toBe('ready'));
    expect(get).toHaveBeenCalledTimes(2);
  });
});
