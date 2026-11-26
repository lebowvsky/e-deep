import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/lib/apiClient';
import { AuthError } from '@/shared/session/authClient';
import { createFakeAuthClient, FAKE_CREDENTIALS } from '@/shared/session/mocks/fakeAuthClient';
import { renderAccountScreen } from '@/test/renderAccountScreen';
import { PasswordChangeForm } from './PasswordChangeForm';

const NEW_PASSWORD = 'nouvelles-bulles-2027';

function renderForm(authClient = createFakeAuthClient()) {
  return renderAccountScreen('/settings', <PasswordChangeForm email={FAKE_CREDENTIALS.email} />, {
    authClient,
  });
}

const currentInput = () => screen.getByLabelText<HTMLInputElement>('Mot de passe actuel');
const newInput = () => screen.getByLabelText<HTMLInputElement>('Nouveau mot de passe');
const submit = () => screen.getByRole('button', { name: /Changer le mot de passe|Changement…/ });

async function fill(user: ReturnType<typeof userEvent.setup>, current: string, next: string) {
  await user.type(currentInput(), current);
  await user.type(newInput(), next);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('PasswordChangeForm — checks before sending', () => {
  it('says what is missing on submit and focuses the first field to fix', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient();
    const changePassword = vi.spyOn(authClient, 'changePassword');
    renderForm(authClient);

    await user.click(submit());

    expect(screen.getByText('Saisis ton mot de passe.')).toBeTruthy();
    expect(screen.getByText('15 caractères minimum.', { selector: 'span' })).toBeTruthy();
    expect(document.activeElement).toBe(currentInput());
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('checks the length of the new password on blur, with its gauge', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(newInput(), 'court');
    expect(screen.queryByText('15 caractères minimum.', { selector: 'span' })).toBeNull();
    await user.tab();

    expect(screen.getByText('15 caractères minimum.', { selector: 'span' })).toBeTruthy();
    expect(newInput().getAttribute('aria-describedby')).toContain(
      screen.getByRole('list').getAttribute('id'),
    );
  });
});

describe('PasswordChangeForm — answers', () => {
  it('changes the password, empties the fields and says the other devices are signed out', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient();
    const changePassword = vi.spyOn(authClient, 'changePassword');
    renderForm(authClient);

    await fill(user, FAKE_CREDENTIALS.password, NEW_PASSWORD);
    await user.click(submit());

    expect(
      await screen.findByText('Mot de passe modifié. Tes autres appareils ont été déconnectés.'),
    ).toBeTruthy();
    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: FAKE_CREDENTIALS.password,
      newPassword: NEW_PASSWORD,
    });
    expect(currentInput().value).toBe('');
    expect(newInput().value).toBe('');
    // A fresh form: the emptied fields are not « missing ».
    expect(screen.queryByText('Saisis ton mot de passe.')).toBeNull();
  });

  it('says a wrong current password under its field, empties and focuses it', async () => {
    const user = userEvent.setup();
    renderForm();

    await fill(user, 'pas-le-bon-mot-de-passe', NEW_PASSWORD);
    await user.click(submit());

    expect(await screen.findByText('Mot de passe actuel incorrect.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(currentInput().value).toBe('');
    expect(currentInput().getAttribute('aria-invalid')).toBe('true');
    expect(newInput().value).toBe(NEW_PASSWORD);
    await waitFor(() => expect(document.activeElement).toBe(currentInput()));
  });

  it('shows the policy refusal of the new password and focuses it', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient();
    vi.spyOn(authClient, 'changePassword').mockRejectedValue(
      new AuthError({ code: 'validation-failed', fieldErrors: { newPassword: ['compromised'] } }),
    );
    renderForm(authClient);

    await fill(user, FAKE_CREDENTIALS.password, NEW_PASSWORD);
    await user.click(submit());

    expect(
      await screen.findByText('Ce mot de passe est trop courant. Choisis-en un autre.'),
    ).toBeTruthy();
    expect(screen.getByText(/Pas un mot de passe courant/).textContent).toContain('non rempli');
    await waitFor(() => expect(document.activeElement).toBe(newInput()));
  });

  it('is busy while sending, and a network failure changes nothing but the banner', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient();
    let fail: () => void = () => undefined;
    const changePassword = vi.spyOn(authClient, 'changePassword').mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = () => reject(new ApiError('timeout', 'The API did not answer.'));
      }),
    );
    renderForm(authClient);

    await fill(user, FAKE_CREDENTIALS.password, NEW_PASSWORD);
    await user.click(submit());
    await user.click(submit());
    expect(submit().textContent).toBe('Changement…');
    expect(submit().getAttribute('aria-busy')).toBe('true');
    expect(currentInput().readOnly).toBe(true);
    expect(changePassword).toHaveBeenCalledOnce();
    act(() => fail());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Connexion impossible. Vérifie ton réseau et réessaie.');
    await waitFor(() => expect(document.activeElement).toBe(alert));
    expect(currentInput().value).toBe(FAKE_CREDENTIALS.password);
  });

  it('counts down a throttling on the button', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const authClient = createFakeAuthClient({ maxFailedLogins: 0, retryAfterS: 5 });
    renderForm(authClient);

    await fill(user, FAKE_CREDENTIALS.password, NEW_PASSWORD);
    await user.click(submit());

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Trop de tentatives. Réessaie dans 5 s.',
    );
    expect(submit().getAttribute('aria-disabled')).toBe('true');
    expect(submit().textContent).toContain('0:05');
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(submit().getAttribute('aria-disabled')).toBeNull();
  });
});
