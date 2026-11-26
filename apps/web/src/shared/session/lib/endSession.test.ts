import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/lib/apiClient';
import { AuthError, type AuthClient } from '../authClient';
import type { AuthServices } from '../authServices';
import { createFakeAuthClient, FAKE_CREDENTIALS } from '../mocks/fakeAuthClient';
import { endSession } from './endSession';

function setUp(logout?: AuthClient['logout']) {
  const authClient = createFakeAuthClient();
  if (logout) vi.spyOn(authClient, 'logout').mockImplementation(logout);
  const announceLogout = vi.fn();
  const purgeDeviceData = vi.fn();
  const onSessionLost = vi.fn();
  const services: AuthServices = {
    authClient,
    broadcast: { announceLogout, onLogout: () => () => undefined },
    purgeDeviceData,
    onSessionLost,
  };
  const queryClient = new QueryClient();
  queryClient.setQueryData(['dives'], { items: [] });
  return { services, queryClient, announceLogout, purgeDeviceData, onSessionLost };
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

  it('closes every session of the account on logout-all, a session already over included', async () => {
    const { services, queryClient, announceLogout } = setUp();
    const logoutAll = vi
      .spyOn(services.authClient, 'logoutAll')
      .mockRejectedValue(new AuthError({ code: 'unauthenticated' }));

    await endSession(services, queryClient, { kind: 'logout-all' });

    expect(logoutAll).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(['dives'])).toBeUndefined();
    expect(announceLogout).toHaveBeenCalledOnce();
  });

  it('deletes the account with its password, then clears everything', async () => {
    const { services, queryClient, purgeDeviceData, announceLogout } = setUp();

    await endSession(services, queryClient, {
      kind: 'delete-account',
      request: { password: FAKE_CREDENTIALS.password },
    });

    expect(queryClient.getQueryData(['dives'])).toBeUndefined();
    expect(purgeDeviceData).toHaveBeenCalledOnce();
    expect(announceLogout).toHaveBeenCalledOnce();
  });

  it('keeps everything when a deletion meets a wrong password', async () => {
    const { services, queryClient, purgeDeviceData, announceLogout, onSessionLost } = setUp();
    const failure = new AuthError({ code: 'invalid-credentials' });
    vi.spyOn(services.authClient, 'deleteAccount').mockRejectedValue(failure);

    await expect(
      endSession(services, queryClient, { kind: 'delete-account', request: { password: 'x' } }),
    ).rejects.toBe(failure);

    expect(queryClient.getQueryData(['dives'])).toEqual({ items: [] });
    expect(purgeDeviceData).not.toHaveBeenCalled();
    expect(announceLogout).not.toHaveBeenCalled();
    expect(onSessionLost).not.toHaveBeenCalled();
  });

  it('hands a deletion whose session is already over to the 401 policy, then rejects', async () => {
    const { services, queryClient, purgeDeviceData, announceLogout, onSessionLost } = setUp();
    const failure = new AuthError({ code: 'unauthenticated' });
    vi.spyOn(services.authClient, 'deleteAccount').mockRejectedValue(failure);

    await expect(
      endSession(services, queryClient, { kind: 'delete-account', request: { password: 'x' } }),
    ).rejects.toBe(failure);

    expect(onSessionLost).toHaveBeenCalledOnce();
    // The account is still there: nothing is announced as signed out by this tab.
    expect(purgeDeviceData).not.toHaveBeenCalled();
    expect(announceLogout).not.toHaveBeenCalled();
  });
});
