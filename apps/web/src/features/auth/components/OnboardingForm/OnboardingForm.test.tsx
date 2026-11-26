import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/lib/apiClient';
import { sessionKeys } from '@/shared/session/api/meApi';
import { AuthError } from '@/shared/session/authClient';
import { createFakeAuthClient } from '@/shared/session/mocks/fakeAuthClient';
import { ME_FIXTURE, NEW_ACCOUNT_FIXTURE } from '@/shared/session/mocks/me';
import { renderAccountScreen } from '@/test/renderAccountScreen';
import { OnboardingForm } from './OnboardingForm';

function renderOnboarding(
  path = '/welcome',
  authClient = createFakeAuthClient({ session: NEW_ACCOUNT_FIXTURE }),
) {
  return renderAccountScreen(path, <OnboardingForm policyVersion="2026-11" />, {
    session: NEW_ACCOUNT_FIXTURE,
    authClient,
  });
}

const levelSelect = () => screen.getByLabelText<HTMLSelectElement>(/Niveau de plongée/);
const lastNameInput = () => screen.getByLabelText<HTMLInputElement>('Nom');
const consentBox = () => screen.getByRole<HTMLInputElement>('checkbox', { name: /J’accepte que/ });
const submit = () => screen.getByRole('button', { name: /Ouvrir mon carnet|Enregistrement…/ });

/** The levels are loaded: their options are in the list. */
const levelsLoaded = () => screen.findByRole('option', { name: 'Niveau 2 · FFESSM' });

afterEach(() => {
  vi.useRealTimers();
});

describe('OnboardingForm — first launch', () => {
  it('sends the level, the last name and the consent, then goes to next', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: NEW_ACCOUNT_FIXTURE });
    const completeOnboarding = vi.spyOn(authClient, 'completeOnboarding');
    const { router, queryClient } = renderOnboarding('/welcome?next=%2Fstats', authClient);
    await levelsLoaded();

    expect(levelSelect().value).toBe('');
    expect(consentBox().checked).toBe(false);
    await user.selectOptions(levelSelect(), 'Niveau 2 · FFESSM');
    await user.type(lastNameInput(), '  Rousseau ');
    await user.click(consentBox());
    await user.click(submit());

    expect(await screen.findByRole('heading', { name: 'Statistiques' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/stats');
    expect(completeOnboarding).toHaveBeenCalledWith({
      lastName: 'Rousseau',
      certificationLevelId: 'ffessm-n2',
      healthDataConsent: true,
      policyVersion: '2026-11',
    });
    expect(queryClient.getQueryData(sessionKeys.me())).toMatchObject({ onboarding: 'complete' });
  });

  it('sends no last name when none is typed, and ignores an external next', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: NEW_ACCOUNT_FIXTURE });
    const completeOnboarding = vi.spyOn(authClient, 'completeOnboarding');
    const { router } = renderOnboarding('/welcome?next=https%3A%2F%2Fevil.com', authClient);
    await levelsLoaded();

    await user.selectOptions(levelSelect(), 'Open Water · PADI');
    await user.click(consentBox());
    await user.click(submit());

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(completeOnboarding).toHaveBeenCalledWith(expect.objectContaining({ lastName: null }));
  });
});

describe('OnboardingForm — checks before sending', () => {
  it('refuses the form without a level nor the consent, and focuses the level', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: NEW_ACCOUNT_FIXTURE });
    const completeOnboarding = vi.spyOn(authClient, 'completeOnboarding');
    renderOnboarding('/welcome', authClient);
    await levelsLoaded();

    await user.click(submit());

    expect(screen.getByText('Choisis ton niveau.')).toBeTruthy();
    expect(
      screen.getByText(
        'Coche la case pour continuer : sans ton accord, ton carnet ne peut pas enregistrer tes plongées.',
      ),
    ).toBeTruthy();
    expect(document.activeElement).toBe(levelSelect());
    expect(consentBox().getAttribute('aria-invalid')).toBe('true');
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  it('refuses the form without the consent alone, and focuses the box', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: NEW_ACCOUNT_FIXTURE });
    const completeOnboarding = vi.spyOn(authClient, 'completeOnboarding');
    renderOnboarding('/welcome', authClient);
    await levelsLoaded();

    await user.selectOptions(levelSelect(), 'Niveau 1 · FFESSM');
    await user.click(submit());

    expect(document.activeElement).toBe(consentBox());
    expect(completeOnboarding).not.toHaveBeenCalled();
  });

  it('checks the last name on blur', async () => {
    const user = userEvent.setup();
    renderOnboarding();
    await levelsLoaded();

    expect(screen.getByText('Facultatif. Il apparaît sur ton carnet.')).toBeTruthy();
    await user.click(lastNameInput());
    await user.paste('a'.repeat(101));
    expect(screen.queryByText('100 caractères maximum.')).toBeNull();
    await user.tab();

    expect(screen.getByText('100 caractères maximum.')).toBeTruthy();
  });

  it('links to the privacy page in a new tab', async () => {
    renderOnboarding();
    await levelsLoaded();

    const link = screen.getByRole('link', { name: /En savoir plus/ });
    expect(link.getAttribute('href')).toBe('/privacy');
    expect(link.getAttribute('target')).toBe('_blank');
  });
});

async function fillAndSend(user: ReturnType<typeof userEvent.setup>) {
  await levelsLoaded();
  await user.selectOptions(levelSelect(), 'Niveau 2 · FFESSM');
  await user.click(consentBox());
  await user.click(submit());
}

describe('OnboardingForm — refusals', () => {
  it('shows a refused level under its field and focuses it', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: NEW_ACCOUNT_FIXTURE });
    vi.spyOn(authClient, 'completeOnboarding').mockRejectedValue(
      new AuthError({
        code: 'validation-failed',
        fieldErrors: { certificationLevelId: ['inactive'] },
      }),
    );
    renderOnboarding('/welcome', authClient);

    await fillAndSend(user);

    expect(await screen.findByText('Choisis un niveau de la liste.')).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(levelSelect()));
  });

  it('is busy while sending, and sends once', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: NEW_ACCOUNT_FIXTURE });
    // Settled at the end: a pending Action would hold back the next tests' (React entangles them).
    let fail: () => void = () => undefined;
    const completeOnboarding = vi.spyOn(authClient, 'completeOnboarding').mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = () => reject(new ApiError('network', 'The API is unreachable.'));
      }),
    );
    renderOnboarding('/welcome', authClient);

    await fillAndSend(user);
    await user.click(submit());

    expect(submit().textContent).toBe('Enregistrement…');
    expect(submit().getAttribute('aria-busy')).toBe('true');
    expect(lastNameInput().readOnly).toBe(true);
    // Every field is locked alike while sending.
    expect(levelSelect().disabled).toBe(true);
    expect(consentBox().disabled).toBe(true);
    expect(completeOnboarding).toHaveBeenCalledOnce();
    act(() => fail());
    await screen.findByRole('alert');
  });

  it('says a network failure in the banner, focused, and changes nothing else', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: NEW_ACCOUNT_FIXTURE });
    vi.spyOn(authClient, 'completeOnboarding').mockRejectedValue(
      new ApiError('network', 'The API is unreachable.'),
    );
    const { router } = renderOnboarding('/welcome', authClient);

    await fillAndSend(user);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Connexion impossible. Vérifie ton réseau et réessaie.');
    await waitFor(() => expect(document.activeElement).toBe(alert));
    expect(router.state.location.pathname).toBe('/welcome');
    expect(levelSelect().value).toBe('ffessm-n2');
    expect(consentBox().checked).toBe(true);
  });

  it('counts down a throttling on the button', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const authClient = createFakeAuthClient({ session: NEW_ACCOUNT_FIXTURE });
    const completeOnboarding = vi
      .spyOn(authClient, 'completeOnboarding')
      .mockRejectedValue(new AuthError({ code: 'too-many-attempts', retryAfterS: 3 }));
    renderOnboarding('/welcome', authClient);

    await fillAndSend(user);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Trop de tentatives. Réessaie dans 3 s.',
    );
    expect(submit().getAttribute('aria-disabled')).toBe('true');
    expect(submit().textContent).toContain('0:03');
    await user.click(submit());
    expect(completeOnboarding).toHaveBeenCalledOnce();

    await act(() => vi.advanceTimersByTimeAsync(3000));
    expect(submit().getAttribute('aria-disabled')).toBeNull();
  });

  it('follows the fresh status when onboarding was completed in another tab', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: NEW_ACCOUNT_FIXTURE });
    vi.spyOn(authClient, 'completeOnboarding').mockRejectedValue(
      new AuthError({ code: 'onboarding-complete' }),
    );
    vi.spyOn(authClient, 'me').mockResolvedValue(ME_FIXTURE);
    const { router, queryClient } = renderOnboarding('/welcome', authClient);

    await fillAndSend(user);

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
    expect(queryClient.getQueryData(sessionKeys.me())).toEqual(ME_FIXTURE);
  });

  it('keeps next when the other tab left a consent to renew', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: NEW_ACCOUNT_FIXTURE });
    vi.spyOn(authClient, 'completeOnboarding').mockRejectedValue(
      new AuthError({ code: 'onboarding-complete' }),
    );
    vi.spyOn(authClient, 'me').mockResolvedValue({ ...ME_FIXTURE, onboarding: 'consent-required' });
    const { router } = renderOnboarding('/welcome?next=%2Fstats', authClient);

    await fillAndSend(user);

    expect(await screen.findByRole('heading', { name: 'Consentement' })).toBeTruthy();
    expect(router.state.location.search).toBe('?next=%2Fstats');
  });
});

describe('OnboardingForm — levels', () => {
  it('focuses the level field, busy, when sent before the levels load', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: NEW_ACCOUNT_FIXTURE });
    vi.spyOn(authClient, 'certificationLevels').mockReturnValue(new Promise(() => undefined));
    const completeOnboarding = vi.spyOn(authClient, 'completeOnboarding');
    renderOnboarding('/welcome', authClient);

    await user.click(consentBox());
    await user.click(submit());

    expect(completeOnboarding).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(levelSelect());
    expect(levelSelect().getAttribute('aria-busy')).toBe('true');
  });

  it('blocks the form until the levels load, and loads them again on demand', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: NEW_ACCOUNT_FIXTURE });
    const levels = vi
      .spyOn(authClient, 'certificationLevels')
      .mockRejectedValueOnce(new ApiError('network', 'The API is unreachable.'));
    const completeOnboarding = vi.spyOn(authClient, 'completeOnboarding');
    renderOnboarding('/welcome', authClient);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Impossible de charger les niveaux.');
    expect(submit().getAttribute('aria-disabled')).toBe('true');
    await user.click(consentBox());
    await user.click(submit());
    expect(completeOnboarding).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(alert);

    await user.click(screen.getByRole('button', { name: 'Réessayer' }));

    await levelsLoaded();
    expect(levels).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(submit().getAttribute('aria-disabled')).toBeNull();
  });
});
