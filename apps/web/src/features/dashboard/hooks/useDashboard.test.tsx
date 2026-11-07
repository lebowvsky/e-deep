import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { useDashboard } from './useDashboard';

const at = (path: string) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>;
  };

describe('useDashboard', () => {
  it.each(['loading', 'empty', 'ready'] as const)('forces the %s state with ?state=', (state) => {
    const { result } = renderHook(() => useDashboard(), {
      wrapper: at(`/dashboard?state=${state}`),
    });
    expect(result.current.status).toBe(state);
  });

  it('starts loading then resolves to ready in dev', async () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: at('/dashboard') });
    expect(result.current.status).toBe('loading');
    await vi.waitFor(() => expect(result.current.status).toBe('ready'));
  });
});
