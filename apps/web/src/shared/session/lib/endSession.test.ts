import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/lib/apiClient';
import { AuthError, type AuthClient } from '../authClient';
import type { AuthServices } from '../authServices';
import { createFakeAuthClient } from '../mocks/fakeAuthClient';
import { endSession } from './endSession';

function setUp(logout?: AuthClient['logout']) {
  const authClient = createFakeAuthClient();
  if (logout) vi.spyOn(authClient, 'logout').mockImplementation(logout);
  const announceLogout = vi.fn();
  const purgeDeviceData = vi.fn();
  const services: AuthServices = {
    authClient,
    broadcast: { announceLogout, onLogout: () => () => undefined },
    purgeDeviceData,
  };
  const queryClient = new QueryClient();
  queryClient.setQueryData(['dives'], { items: [] });
  return { services, queryClient, announceLogout, purgeDeviceData };
}

describe('endSession', () => {
  it('closes the session, then clears the cache, the device and the other tabs', async () => {
    const { services, queryClient, announceLogout, purgeDeviceData } = setUp();

    await endSession(services, queryClient);

    expect(queryClient.getQueryData(['dives'])).toBeUndefined();
    expect(purgeDeviceData).toHaveBeenCalledOnce();
    expect(announceLogout).toHaveBeenCalledOnce();
  });

  it('treats a session already over as signed out', async () => {
    const { services, queryClient, purgeDeviceData } = setUp(() =>
      Promise.reject(new AuthError({ code: 'unauthenticated' })),
    );

    await endSession(services, queryClient);

    expect(purgeDeviceData).toHaveBeenCalledOnce();
  });

  it('changes nothing when the API cannot close the session', async () => {
    const failure = new ApiError('network', 'The API is unreachable.');
    const { services, queryClient, announceLogout, purgeDeviceData } = setUp(() =>
      Promise.reject(failure),
    );

    await expect(endSession(services, queryClient)).rejects.toBe(failure);

    expect(queryClient.getQueryData(['dives'])).toEqual({ items: [] });
    expect(purgeDeviceData).not.toHaveBeenCalled();
    expect(announceLogout).not.toHaveBeenCalled();
  });
});
