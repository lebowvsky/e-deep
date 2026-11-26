import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/lib/apiClient';
import { sessionKeys } from '@/shared/session/api/meApi';
import { AuthError } from '@/shared/session/authClient';
import { createFakeAuthClient, FAKE_CREDENTIALS } from '@/shared/session/mocks/fakeAuthClient';
import { renderAccountScreen } from '@/test/renderAccountScreen';
import { DeleteAccountDialog } from './DeleteAccountDialog';

function renderDialog(authClient = createFakeAuthClient(), onCancel = vi.fn()) {
  return {
    onCancel,
    ...renderAccountScreen('/settings', <DeleteAccountDialog onCancel={onCancel} />, {
      authClient,
    }),
  };
}

const passwordInput = () => screen.getByLabelText<HTMLInputElement>('Mot de passe');
const confirm = () => screen.getByRole('button', { name: /Supprimer définitivement|Suppression…/ });

afterEach(() => {
  vi.useRealTimers();
});

describe('DeleteAccountDialog', () => {
  it('is a modal asking for the password, its confirmation blocked while the field is empty', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient();
    const deleteAccount = vi.spyOn(authClient, 'deleteAccount');
    renderDialog(authClient);

    expect(screen.getByRole('alertdialog', { name: 'Supprimer ton compte ?' })).toBeTruthy();
    expect(document.activeElement).toBe(passwordInput());
    expect(confirm().getAttribute('aria-disabled')).toBe('true');
    await user.click(confirm());
    await user.keyboard('{Enter}');

    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('keeps the dialog open on a wrong password, emptied and focused', async () => {
    const user = userEvent.setup();
    const { router } = renderDialog();

    await user.type(passwordInput(), 'pas-le-bon');
    await user.click(confirm());

    expect(await screen.findByText('Mot de passe incorrect.')).toBeTruthy();
    expect(passwordInput().value).toBe('');
    await waitFor(() => expect(document.activeElement).toBe(passwordInput()));
    expect(router.state.location.pathname).toBe('/settings');
  });

  it('says a password the API refuses under the field, as the account’s own, and focuses it', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient();
    vi.spyOn(authClient, 'deleteAccount').mockRejectedValue(
      new AuthError({ code: 'validation-failed', fieldErrors: { password: ['too-long'] } }),
    );
    const { router } = renderDialog(authClient);

    await user.type(passwordInput(), 'beaucoup-trop-long');
    await user.click(confirm());

    expect(await screen.findByText('Mot de passe incorrect.')).toBeTruthy();
    expect(screen.queryByText('128 caractères maximum.')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(passwordInput().value).toBe('beaucoup-trop-long');
    await waitFor(() => expect(document.activeElement).toBe(passwordInput()));
    expect(router.state.location.pathname).toBe('/settings');
  });

  it('deletes the account, ends the session and lands on the landing page with its notice', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient();
    const { router, queryClient } = renderDialog(authClient);

    await user.type(passwordInput(), `${FAKE_CREDENTIALS.password}{Enter}`);

    expect(await screen.findByRole('heading', { name: 'Accueil' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/');
    expect(screen.getByText('account-deleted')).toBeTruthy();
    expect(authClient.session).toBeNull();
    expect(queryClient.getQueryData(sessionKeys.me())).toBeUndefined();
  });

  it('is busy while deleting, and says a failure in its banner', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient();
    let fail: () => void = () => undefined;
    vi.spyOn(authClient, 'deleteAccount').mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = () => reject(new ApiError('network', 'The API is unreachable.'));
      }),
    );
    const { queryClient } = renderDialog(authClient);

    await user.type(passwordInput(), FAKE_CREDENTIALS.password);
    await user.click(confirm());
    expect(confirm().textContent).toBe('Suppression…');
    expect(confirm().getAttribute('aria-busy')).toBe('true');
    act(() => fail());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Connexion impossible. Vérifie ton réseau et réessaie.');
    await waitFor(() => expect(document.activeElement).toBe(alert));
    expect(queryClient.getQueryData(sessionKeys.me())).not.toBeUndefined();
  });

  it('counts down a throttling on its button', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDialog(createFakeAuthClient({ maxFailedLogins: 0, retryAfterS: 4 }));

    await user.type(passwordInput(), `${FAKE_CREDENTIALS.password}{Enter}`);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Trop de tentatives. Réessaie dans 4 s.',
    );
    expect(confirm().textContent).toContain('0:04');
    expect(confirm().getAttribute('aria-disabled')).toBe('true');
    await act(() => vi.advanceTimersByTimeAsync(4000));
    expect(confirm().getAttribute('aria-disabled')).toBeNull();
  });

  it('closes on « Annuler »', async () => {
    const user = userEvent.setup();
    const { onCancel } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onCancel).toHaveBeenCalledOnce();
  });
});
