import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';
import { adminMe, createFakeApiClient, httpError, networkError } from '@/test/fakeApiClient';
import { createRoutes } from '../routes';

const GENERIC_REFUSAL =
  'Identifiants incorrects. Vérifiez l’e-mail, le mot de passe et le code, puis réessayez.';

async function renderLogin(path = '/login') {
  const { apiClient, ...api } = createFakeApiClient();
  // No session yet: the login page shows its form.
  api.get.mockRejectedValueOnce(httpError(401));
  const router = createMemoryRouter(createRoutes({ apiClient }), { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { name: 'Connexion au back-office' });
  return { api, router };
}

const field = (name: string) => screen.getByLabelText<HTMLInputElement>(name);
const submitButton = () => screen.getByRole('button', { name: /Se connecter|Réessayer|Connexion/ });

function fillAndSubmit({
  email = 'staff@e-deep.test',
  password = 'a-long-password',
  code = '123456',
} = {}) {
  fireEvent.change(field('E-mail'), { target: { value: email } });
  fireEvent.change(field('Mot de passe'), { target: { value: password } });
  fireEvent.change(field('Code de vérification'), { target: { value: code } });
  fireEvent.click(submitButton());
}

describe('LoginPage', () => {
  it('labels its fields, the code as a 6-digit one-time code', async () => {
    await renderLogin();

    expect(field('E-mail').autocomplete).toBe('username');
    expect(field('Mot de passe').type).toBe('password');
    const code = field('Code de vérification');
    expect(code.inputMode).toBe('numeric');
    expect(code.autocomplete).toBe('one-time-code');
    expect(code.pattern).toBe('[0-9]{6}');
    expect(document.activeElement).toBe(field('E-mail'));
  });

  it('signs in, then goes on to next', async () => {
    const { api, router } = await renderLogin('/login?next=%2Faccounts');
    api.post.mockResolvedValue(adminMe('support'));
    api.get.mockResolvedValue(adminMe('support'));

    fillAndSubmit({ code: '123 456' });

    await waitFor(() => expect(router.state.location.pathname).toBe('/accounts'));
    expect(api.post).toHaveBeenCalledOnce();
    expect(api.post.mock.calls[0]).toEqual([
      '/admin/auth/login',
      { email: 'staff@e-deep.test', password: 'a-long-password', totpCode: '123456' },
    ]);
    expect(await screen.findByRole('heading', { name: 'Page introuvable' })).toBeDefined();
  });

  it('signs in to the home page when next leaves the app', async () => {
    const { api, router } = await renderLogin('/login?next=https%3A%2F%2Fevil.com');
    api.post.mockResolvedValue(adminMe());
    api.get.mockResolvedValue(adminMe());

    fillAndSubmit();

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('says one generic message on invalid credentials, and empties the password and the code', async () => {
    const { api } = await renderLogin();
    api.post.mockRejectedValue(httpError(401, 'invalid-credentials'));

    fillAndSubmit();

    expect((await screen.findByRole('alert')).textContent).toBe(GENERIC_REFUSAL);
    expect(field('E-mail').value).toBe('staff@e-deep.test');
    expect(field('Mot de passe').value).toBe('');
    expect(field('Code de vérification').value).toBe('');
    expect(document.activeElement).toBe(field('Mot de passe'));
  });

  it('counts down on the button after too many attempts, and sends nothing meanwhile', async () => {
    const { api } = await renderLogin();
    api.post.mockRejectedValue(httpError(429, 'too-many-attempts', 120));

    fillAndSubmit();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Trop de tentatives. Réessayez dans 2 min.',
    );
    const button = submitButton();
    expect(button.textContent).toMatch(/^Réessayer dans [12]:\d{2}$/);
    expect(button.getAttribute('aria-disabled')).toBe('true');

    fireEvent.click(button);
    expect(api.post).toHaveBeenCalledOnce();
  });

  it('empties the code after too many attempts, and keeps the e-mail and the password', async () => {
    const { api } = await renderLogin();
    api.post.mockRejectedValue(httpError(429, 'too-many-attempts', 120));

    fillAndSubmit();

    await screen.findByRole('alert');
    expect(field('Code de vérification').value).toBe('');
    expect(field('E-mail').value).toBe('staff@e-deep.test');
    expect(field('Mot de passe').value).toBe('a-long-password');
  });

  it('shows a generic banner when the API is unreachable, and keeps what was typed', async () => {
    const { api } = await renderLogin();
    api.post.mockRejectedValue(networkError());

    fillAndSubmit();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Le serveur est injoignable. Vérifiez votre connexion et réessayez.',
    );
    expect(field('Mot de passe').value).toBe('a-long-password');
  });

  it('shows a generic banner on a server error', async () => {
    const { api } = await renderLogin();
    api.post.mockRejectedValue(httpError(503));

    fillAndSubmit();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Une erreur est survenue. Réessayez dans un instant.',
    );
  });

  it('refuses empty fields and a malformed code before sending, focus on the first one', async () => {
    const { api } = await renderLogin();

    fillAndSubmit({ email: '', password: '', code: '12a' });

    expect(field('E-mail').getAttribute('aria-invalid')).toBe('true');
    expect(field('Mot de passe').getAttribute('aria-invalid')).toBe('true');
    expect(field('Code de vérification').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByText('Saisissez un code de 6 chiffres.')).toBeDefined();
    expect(document.activeElement).toBe(field('E-mail'));
    expect(api.post).not.toHaveBeenCalled();
  });

  it('sends a signed-in staff member on to next at once', async () => {
    const { apiClient, ...api } = createFakeApiClient();
    api.get.mockResolvedValue(adminMe());
    const router = createMemoryRouter(createRoutes({ apiClient }), {
      initialEntries: ['/login?next=%2Faccounts'],
    });
    render(<RouterProvider router={router} />);

    await waitFor(() => expect(router.state.location.pathname).toBe('/accounts'));
  });
});
