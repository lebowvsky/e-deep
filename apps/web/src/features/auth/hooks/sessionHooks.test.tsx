import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { sessionKeys } from '@/shared/session/api/meApi';
import { isAuthFailure } from '@/shared/session/authClient';
import { AuthServicesContext, type AuthServices } from '@/shared/session/authServices';
import { createFakeAuthClient, FAKE_CREDENTIALS } from '@/shared/session/mocks/fakeAuthClient';
import { ME_FIXTURE, NEW_ACCOUNT_FIXTURE } from '@/shared/session/mocks/me';
import { createTestQueryClient } from '@/test/queryClient';
import { useCompleteOnboarding } from './useCompleteOnboarding';
import { useGrantConsent } from './useGrantConsent';
import { useLogin } from './useLogin';

function setup(session: typeof ME_FIXTURE | null) {
  const queryClient = createTestQueryClient();
  const services: AuthServices = {
    authClient: createFakeAuthClient({ session }),
    broadcast: { announceLogout: () => undefined, onLogout: () => () => undefined },
    purgeDeviceData: () => undefined,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AuthServicesContext value={services}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </AuthServicesContext>
  );
  return { queryClient, wrapper };
}

describe('useLogin', () => {
  it('drops the previous cache, and the answered /me becomes the session', async () => {
    const { queryClient, wrapper } = setup(null);
    queryClient.setQueryData(['dives', 'log'], { dives: ['of someone else'] });
    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(() => result.current({ ...FAKE_CREDENTIALS, rememberMe: true }));

    expect(queryClient.getQueryData(['dives', 'log'])).toBeUndefined();
    expect(queryClient.getQueryData(sessionKeys.me())).toEqual(ME_FIXTURE);
  });

  it('rejects a wrong password with a typed error, the session unchanged', async () => {
    const { queryClient, wrapper } = setup(null);
    const { result } = renderHook(() => useLogin(), { wrapper });

    const error = await act(() =>
      result
        .current({ email: FAKE_CREDENTIALS.email, password: 'nope', rememberMe: false })
        .catch((e: unknown) => e),
    );

    expect(isAuthFailure(error, 'invalid-credentials')).toBe(true);
    expect(queryClient.getQueryData(sessionKeys.me())).toBeUndefined();
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
