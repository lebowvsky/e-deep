import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/shared/lib/apiClient';
import { sessionKeys } from '@/shared/session/api/meApi';
import { AuthError } from '@/shared/session/authClient';
import { createFakeAuthClient, FAKE_CREDENTIALS } from '@/shared/session/mocks/fakeAuthClient';
import { ME_FIXTURE } from '@/shared/session/mocks/me';
import { renderAuthForm, type RenderAuthFormOptions } from '@/test/renderAuthForm';
import { LoginForm } from './LoginForm';

function renderLogin(path = '/login', options: RenderAuthFormOptions = {}) {
  return renderAuthForm(path, (props) => <LoginForm {...props} />, options);
}

const emailInput = () => screen.getByLabelText<HTMLInputElement>('E-mail');
const passwordInput = () => screen.getByLabelText<HTMLInputElement>('Mot de passe');
const submit = () => screen.getByRole('button', { name: /Se connecter|Connexion…/ });

afterEach(() => {
  vi.useRealTimers();
});

describe('LoginForm — valid credentials', () => {
  it('signs in with Entrée and goes to next', async () => {
    const user = userEvent.setup();
    const { router, queryClient } = renderLogin('/login?next=%2Fstats');

    await user.type(emailInput(), FAKE_CREDENTIALS.email);
    await user.type(passwordInput(), `${FAKE_CREDENTIALS.password}{Enter}`);

    expect(await screen.findByRole('heading', { name: 'Statistiques' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/stats');
    expect(queryClient.getQueryData(sessionKeys.me())).toEqual(ME_FIXTURE);
  });

  it('ignores an external next', async () => {
    const user = userEvent.setup();
    const { router } = renderLogin('/login?next=https%3A%2F%2Fevil.com');

    await user.type(emailInput(), FAKE_CREDENTIALS.email);
    await user.type(passwordInput(), FAKE_CREDENTIALS.password);
    await user.click(submit());

    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'));
  });

  it('sends « Rester connecté » as rememberMe, ticked by default', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: null });
    const login = vi.spyOn(authClient, 'login');
    renderLogin('/login', { authClient });

    expect(
      screen.getByLabelText<HTMLInputElement>('Rester connecté sur cet appareil').checked,
    ).toBe(true);
    await user.click(screen.getByLabelText('Rester connecté sur cet appareil'));
    await user.type(emailInput(), FAKE_CREDENTIALS.email);
    await user.type(passwordInput(), 'pas-le-bon-mot-de-passe');
    await user.click(submit());

    await screen.findByRole('alert');
    expect(login).toHaveBeenCalledWith({
      email: FAKE_CREDENTIALS.email,
      password: 'pas-le-bon-mot-de-passe',
      rememberMe: false,
    });
    // The end of the Action does not tick it again.
    expect(
      screen.getByLabelText<HTMLInputElement>('Rester connecté sur cet appareil').checked,
    ).toBe(false);
  });
});

describe('LoginForm — checks before sending', () => {
  it('says what is missing on submit and focuses the first field to fix', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: null });
    const login = vi.spyOn(authClient, 'login');
    renderLogin('/login', { authClient });

    await user.click(submit());

    expect(screen.getByText('Saisis ton adresse e-mail.')).toBeTruthy();
    expect(screen.getByText('Saisis ton mot de passe.')).toBeTruthy();
    expect(document.activeElement).toBe(emailInput());
    expect(emailInput().getAttribute('aria-invalid')).toBe('true');
    expect(login).not.toHaveBeenCalled();
  });

  it('checks the e-mail on blur, not while it is typed', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(emailInput(), 'marine@');
    expect(screen.queryByText(/adresse e-mail valide/)).toBeNull();
    await user.tab();

    expect(screen.getByText(/adresse e-mail valide/)).toBeTruthy();
  });
});

describe('LoginForm — refusals', () => {
  it('says nothing of which field is wrong, empties the password and focuses it', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(emailInput(), FAKE_CREDENTIALS.email);
    await user.type(passwordInput(), 'pas-le-bon-mot-de-passe');
    await user.click(submit());

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(
      'E-mail ou mot de passe incorrect. Vérifie ta saisie ou réinitialise ton mot de passe.',
    );
    expect(emailInput().getAttribute('aria-invalid')).toBe('true');
    expect(passwordInput().getAttribute('aria-invalid')).toBe('true');
    expect(passwordInput().value).toBe('');
    // Emptied for the next try, not reported as missing.
    expect(screen.queryByText('Saisis ton mot de passe.')).toBeNull();
    expect(emailInput().value).toBe(FAKE_CREDENTIALS.email);
    await waitFor(() => expect(document.activeElement).toBe(passwordInput()));
  });

  it('counts down a throttling, then lets the diver try again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const authClient = createFakeAuthClient({ session: null, maxFailedLogins: 0, retryAfterS: 3 });
    const login = vi.spyOn(authClient, 'login');
    renderLogin('/login', { authClient });

    await user.type(emailInput(), FAKE_CREDENTIALS.email);
    await user.type(passwordInput(), `${FAKE_CREDENTIALS.password}{Enter}`);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Trop de tentatives. Réessaie dans 3 s.',
    );
    expect(submit().getAttribute('aria-disabled')).toBe('true');
    expect(submit().textContent).toContain('0:03');

    // Submitting while it counts down sends nothing.
    await user.type(passwordInput(), 'x{Enter}');
    expect(login).toHaveBeenCalledOnce();

    // The alert keeps its words (not announced again every second); the button counts down.
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(screen.getByRole('alert').textContent).toBe('Trop de tentatives. Réessaie dans 3 s.');
    expect(submit().textContent).toContain('0:02');

    await act(() => vi.advanceTimersByTimeAsync(2000));

    expect(screen.queryByRole('alert')).toBeNull();
    expect(submit().getAttribute('aria-disabled')).toBeNull();
    expect(submit().textContent).toBe('Se connecter');
  });

  it('asks to wait without a countdown when the API gave no delay', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: null });
    vi.spyOn(authClient, 'login').mockRejectedValue(
      new AuthError({ code: 'too-many-attempts', retryAfterS: null }),
    );
    renderLogin('/login', { authClient });

    await user.type(emailInput(), FAKE_CREDENTIALS.email);
    await user.type(passwordInput(), `${FAKE_CREDENTIALS.password}{Enter}`);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Trop de tentatives. Réessaie dans quelques minutes.',
    );
    expect(submit().getAttribute('aria-disabled')).toBeNull();
  });

  it.each([
    [new ApiError('network', 'down'), 'Connexion impossible. Vérifie ton réseau et réessaie.'],
    [
      new ApiError('http', 'HTTP 503', { status: 503 }),
      'Une erreur est survenue. Réessaie dans un instant.',
    ],
  ])('says %s, the password kept', async (error, message) => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: null });
    vi.spyOn(authClient, 'login').mockRejectedValue(error);
    renderLogin('/login', { authClient });

    await user.type(emailInput(), FAKE_CREDENTIALS.email);
    await user.type(passwordInput(), `${FAKE_CREDENTIALS.password}{Enter}`);

    expect((await screen.findByRole('alert')).textContent).toBe(message);
    expect(passwordInput().value).toBe(FAKE_CREDENTIALS.password);
  });
});

describe('LoginForm — while sending', () => {
  it('sends once however often it is submitted', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: null });
    const login = vi.spyOn(authClient, 'login').mockReturnValue(new Promise(() => undefined));
    renderLogin('/login', { authClient });

    await user.type(emailInput(), FAKE_CREDENTIALS.email);
    await user.type(passwordInput(), `${FAKE_CREDENTIALS.password}{Enter}`);
    const button = await screen.findByRole('button', { name: 'Connexion…' });
    await user.click(button);
    await user.type(passwordInput(), '{Enter}');

    expect(login).toHaveBeenCalledOnce();
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(passwordInput().hasAttribute('readonly')).toBe(true);
  });

  it('sends once when submitted twice in the same tick', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: null });
    const login = vi.spyOn(authClient, 'login').mockReturnValue(new Promise(() => undefined));
    renderLogin('/login', { authClient });
    await user.type(emailInput(), FAKE_CREDENTIALS.email);
    await user.type(passwordInput(), FAKE_CREDENTIALS.password);

    const form = submit().closest('form');
    if (form === null) throw new Error('No form');
    fireEvent.submit(form);
    fireEvent.submit(form);

    await screen.findByRole('button', { name: 'Connexion…' });
    expect(login).toHaveBeenCalledOnce();
  });
});

describe('LoginForm — accessibility', () => {
  it('names the password toggle and tells its state', async () => {
    const user = userEvent.setup();
    renderLogin();
    const toggle = screen.getByRole('button', { name: 'Afficher le mot de passe' });

    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(passwordInput().getAttribute('type')).toBe('password');
    await user.click(toggle);

    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(passwordInput().getAttribute('type')).toBe('text');
  });

  it('fills the e-mail with the right hints for keyboards and managers', () => {
    renderLogin();

    expect(emailInput().getAttribute('autocomplete')).toBe('username');
    expect(emailInput().getAttribute('inputmode')).toBe('email');
    expect(passwordInput().getAttribute('autocomplete')).toBe('current-password');
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' }).getAttribute('href')).toBe(
      '/forgot-password',
    );
  });
});
