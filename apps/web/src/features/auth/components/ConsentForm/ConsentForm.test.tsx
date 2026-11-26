import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/lib/apiClient';
import { sessionKeys } from '@/shared/session/api/meApi';
import { AuthError } from '@/shared/session/authClient';
import { createFakeAuthClient } from '@/shared/session/mocks/fakeAuthClient';
import { ME_FIXTURE } from '@/shared/session/mocks/me';
import { renderAccountScreen } from '@/test/renderAccountScreen';
import { ConsentForm } from './ConsentForm';

const CONSENT_REQUIRED = { ...ME_FIXTURE, onboarding: 'consent-required' as const };

function renderConsent(
  path = '/consent',
  authClient = createFakeAuthClient({ session: CONSENT_REQUIRED }),
) {
  return renderAccountScreen(path, <ConsentForm policyVersion="2026-11" />, {
    session: CONSENT_REQUIRED,
    authClient,
  });
}

const consentBox = () => screen.getByRole<HTMLInputElement>('checkbox', { name: /J’accepte que/ });
const submit = () => screen.getByRole('button', { name: /Continuer|Enregistrement…/ });

afterEach(() => {
  vi.useRealTimers();
});

describe('ConsentForm', () => {
  it('starts unticked and refuses to go on without the consent', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: CONSENT_REQUIRED });
    const grantConsent = vi.spyOn(authClient, 'grantConsent');
    renderConsent('/consent', authClient);

    expect(consentBox().checked).toBe(false);
    await user.click(submit());

    expect(screen.getByText(/^Coche la case pour continuer/)).toBeTruthy();
    expect(document.activeElement).toBe(consentBox());
    expect(grantConsent).not.toHaveBeenCalled();
  });

  it('renews the consent to the given version, then goes to next', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: CONSENT_REQUIRED });
    const grantConsent = vi.spyOn(authClient, 'grantConsent');
    const { router, queryClient } = renderConsent('/consent?next=%2Fstats', authClient);

    await user.click(consentBox());
    await user.click(submit());

    expect(await screen.findByRole('heading', { name: 'Statistiques' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/stats');
    expect(grantConsent).toHaveBeenCalledWith({
      purpose: 'health_data_processing',
      policyVersion: '2026-11',
    });
    expect(queryClient.getQueryData(sessionKeys.me())).toMatchObject({ onboarding: 'complete' });
  });

  it('is busy while sending, then says a failure in the focused banner', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: CONSENT_REQUIRED });
    let fail: () => void = () => undefined;
    vi.spyOn(authClient, 'grantConsent').mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = () => reject(new ApiError('http', 'HTTP 500', { status: 500 }));
      }),
    );
    const { router } = renderConsent('/consent', authClient);

    await user.click(consentBox());
    await user.click(submit());
    expect(submit().textContent).toBe('Enregistrement…');
    expect(submit().getAttribute('aria-busy')).toBe('true');
    act(() => fail());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Une erreur est survenue. Réessaie dans un instant.');
    await waitFor(() => expect(document.activeElement).toBe(alert));
    expect(router.state.location.pathname).toBe('/consent');
    expect(consentBox().checked).toBe(true);
  });

  it('counts down a throttling on the button', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const authClient = createFakeAuthClient({ session: CONSENT_REQUIRED });
    vi.spyOn(authClient, 'grantConsent').mockRejectedValue(
      new AuthError({ code: 'too-many-attempts', retryAfterS: 2 }),
    );
    renderConsent('/consent', authClient);

    await user.click(consentBox());
    await user.click(submit());

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Trop de tentatives. Réessaie dans 2 s.',
    );
    expect(submit().textContent).toContain('0:02');
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(submit().getAttribute('aria-disabled')).toBeNull();
  });
});
