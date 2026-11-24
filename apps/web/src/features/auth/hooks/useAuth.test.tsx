import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { sessionKeys } from '@/shared/session/api/meApi';
import { isAuthFailure } from '@/shared/session/authClient';
import { AuthServicesContext, type AuthServices } from '@/shared/session/authServices';
import { createFakeAuthClient, FAKE_CREDENTIALS } from '@/shared/session/mocks/fakeAuthClient';
import { ME_FIXTURE, NEW_ACCOUNT_FIXTURE } from '@/shared/session/mocks/me';
import { createTestQueryClient } from '@/test/queryClient';
import { useAuth } from './useAuth';
import { useCompleteOnboarding } from './useCompleteOnboarding';
import { useGrantConsent } from './useGrantConsent';

function setup(session: typeof ME_FIXTURE | null) {
  const queryClient = createTestQueryClient();
  const announceLogout = vi.fn();
  const purgeDeviceData = vi.fn();
  const services: AuthServices = {
    authClient: createFakeAuthClient({ session }),
    broadcast: { announceLogout, onLogout: () => () => undefined },
    purgeDeviceData,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthServicesContext value={services}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AuthServicesContext>
  );
  return { queryClient, announceLogout, purgeDeviceData, wrapper };
}

describe('useAuth', () => {
  it('says signed out without session, signed in with one', async () => {
    const anonymous = setup(null);
    const { result: out } = renderHook(() => useAuth(), { wrapper: anonymous.wrapper });
    expect(out.current.session.status).toBe('loading');
    await waitFor(() => expect(out.current.session.status).toBe('signed-out'));

    const known = setup(ME_FIXTURE);
    const { result: signedIn } = renderHook(() => useAuth(), { wrapper: known.wrapper });
    await waitFor(() =>
      expect(signedIn.current.session).toEqual({ status: 'signed-in', me: ME_FIXTURE }),
    );
  });

  it('logs in: the previous cache is dropped and the answered /me becomes the session', async () => {
    const { queryClient, wrapper } = setup(null);
    queryClient.setQueryData(['dives', 'log'], { dives: ['of someone else'] });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(() => result.current.login({ ...FAKE_CREDENTIALS, rememberMe: true }));

    expect(queryClient.getQueryData(['dives', 'log'])).toBeUndefined();
    expect(queryClient.getQueryData(sessionKeys.me())).toEqual(ME_FIXTURE);
    await waitFor(() => expect(result.current.session.status).toBe('signed-in'));
  });

  it('rejects a wrong password with a typed error, the session unchanged', async () => {
    const { queryClient, wrapper } = setup(null);
    const { result } = renderHook(() => useAuth(), { wrapper });

    const error = await act(() =>
      result.current
        .login({ email: FAKE_CREDENTIALS.email, password: 'nope', rememberMe: false })
        .catch((e: unknown) => e),
    );

    expect(isAuthFailure(error, 'invalid-credentials')).toBe(true);
    expect(queryClient.getQueryData(sessionKeys.me())).toBeUndefined();
  });

  it('logs out: cache emptied, device data erased, other tabs told', async () => {
    const { queryClient, announceLogout, purgeDeviceData, wrapper } = setup(ME_FIXTURE);
    queryClient.setQueryData(['dives', 'log'], { dives: [] });
    queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: () => Promise.resolve('dive') });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(() => result.current.logout());

    expect(queryClient.getQueryData(['dives', 'log'])).toBeUndefined();
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    expect(purgeDeviceData).toHaveBeenCalledOnce();
    expect(announceLogout).toHaveBeenCalledOnce();
  });
});

describe('onboarding hooks', () => {
  it('useCompleteOnboarding puts the answered /me in the cache', async () => {
    const { queryClient, wrapper } = setup(NEW_ACCOUNT_FIXTURE);
    queryClient.setQueryData(sessionKeys.me(), NEW_ACCOUNT_FIXTURE);
    const { result } = renderHook(() => useCompleteOnboarding(), { wrapper });

    await act(() =>
      result.current.mutateAsync({
        lastName: 'Rousseau',
        certificationLevelId: 'ffessm-n2',
        healthDataConsent: true,
        policyVersion: '2026-11',
      }),
    );

    expect(queryClient.getQueryData(sessionKeys.me())).toMatchObject({
      onboarding: 'complete',
      diver: { lastName: 'Rousseau', level: { code: 'N2' } },
    });
  });

  it('useGrantConsent puts the answered /me in the cache', async () => {
    const outdated = { ...ME_FIXTURE, onboarding: 'consent-required' as const };
    const { queryClient, wrapper } = setup(outdated);
    queryClient.setQueryData(sessionKeys.me(), outdated);
    const { result } = renderHook(() => useGrantConsent(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ purpose: 'health_data_processing', policyVersion: '2026-11' }),
    );

    expect(queryClient.getQueryData(sessionKeys.me())).toMatchObject({ onboarding: 'complete' });
  });
});
