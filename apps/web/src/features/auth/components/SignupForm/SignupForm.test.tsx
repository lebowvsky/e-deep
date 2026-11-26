import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sessionKeys } from '@/shared/session/api/meApi';
import { AuthError, type AuthFailure } from '@/shared/session/authClient';
import { createFakeAuthClient, FAKE_CREDENTIALS } from '@/shared/session/mocks/fakeAuthClient';
import { renderAuthForm, type RenderAuthFormOptions } from '@/test/renderAuthForm';
import { SignupForm } from './SignupForm';

const GOOD_PASSWORD = 'palanquee-du-matin';

function renderSignup(path = '/signup', options: RenderAuthFormOptions = {}) {
  return renderAuthForm(path, (props) => <SignupForm {...props} />, options);
}

/** A fake client whose sign-up is refused with `failure`. */
function refusing(failure: AuthFailure) {
  const authClient = createFakeAuthClient({ session: null });
  vi.spyOn(authClient, 'signup').mockRejectedValue(new AuthError(failure));
  return authClient;
}

const firstNameInput = () => screen.getByLabelText('Prénom');
const emailInput = () => screen.getByLabelText('E-mail');
const passwordInput = () => screen.getByLabelText('Mot de passe');
/** A criterion of the list the password input points to. */
const criterion = (name: RegExp) => {
  const criteria = passwordInput().getAttribute('aria-describedby')?.split(' ').at(-1) ?? '';
  const list = document.getElementById(criteria);
  if (list === null) throw new Error('No criteria list described the password');
  return within(list).getByText(name, { selector: 'li' });
};

async function fill(user: ReturnType<typeof userEvent.setup>, password = GOOD_PASSWORD) {
  await user.type(firstNameInput(), 'Marine');
  await user.type(emailInput(), 'nouvelle@exemple.fr');
  await user.type(passwordInput(), password);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('SignupForm — a new account', () => {
  it('creates it with Entrée and goes to /welcome', async () => {
    const user = userEvent.setup();
    const { router, queryClient } = renderSignup('/signup?next=%2Fstats');

    await fill(user, `${GOOD_PASSWORD}{Enter}`);

    expect(await screen.findByRole('heading', { name: 'Bienvenue' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/welcome');
    expect(queryClient.getQueryData(sessionKeys.me())).toMatchObject({
      onboarding: 'profile-required',
      diver: { firstName: 'Marine' },
    });
  });

  it('gives the autofill hints of a new account', () => {
    renderSignup();

    expect(firstNameInput().getAttribute('autocomplete')).toBe('given-name');
    expect(emailInput().getAttribute('autocomplete')).toBe('email');
    expect(passwordInput().getAttribute('autocomplete')).toBe('new-password');
    expect(
      screen.getByRole('link', { name: 'conditions d’utilisation' }).getAttribute('href'),
    ).toBe('/terms');
  });
});

describe('SignupForm — password criteria', () => {
  it('follows the length at every keystroke, blocking under 15', async () => {
    const user = userEvent.setup();
    renderSignup();
    const length = () => criterion(/15 caractères minimum/);

    await user.type(passwordInput(), 'a'.repeat(14));
    expect(length().getAttribute('data-state')).toBe('pending');
    expect(length().textContent).toContain('non rempli');
    expect(document.querySelector('[data-tone]')?.getAttribute('data-tone')).toBe('warning');

    await user.type(passwordInput(), 'a');
    expect(length().getAttribute('data-state')).toBe('met');
    expect(length().textContent).toContain(': rempli');
    expect(document.querySelector('[data-tone]')?.getAttribute('data-tone')).toBe('success');
    expect(criterion(/Pas un mot de passe courant/).textContent).toContain('vérifié à l’envoi');
  });

  it('announces the length criterion once the typing pauses', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSignup();
    const live = document.querySelector('[aria-live="polite"]');

    await user.type(passwordInput(), 'abc');
    expect(live?.textContent).toBe('');

    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(live?.textContent).toBe('15 caractères minimum : non rempli.');
  });

  it('refuses a short password before sending it', async () => {
    const user = userEvent.setup();
    const authClient = createFakeAuthClient({ session: null });
    const signup = vi.spyOn(authClient, 'signup');
    renderSignup('/signup', { authClient });

    await fill(user, 'court');
    await user.click(screen.getByRole('button', { name: 'Créer mon carnet' }));

    expect(screen.getByText('15 caractères minimum.')).toBeTruthy();
    expect(document.activeElement).toBe(passwordInput());
    expect(signup).not.toHaveBeenCalled();
  });
});

describe('SignupForm — checks before sending', () => {
  it('says what is missing and focuses the first field to fix', async () => {
    const user = userEvent.setup();
    renderSignup();

    await user.click(screen.getByRole('button', { name: 'Créer mon carnet' }));

    expect(screen.getByText('Saisis ton prénom.')).toBeTruthy();
    expect(screen.getByText('Saisis ton adresse e-mail.')).toBeTruthy();
    expect(document.activeElement).toBe(firstNameInput());
  });
});

describe('SignupForm — refusals', () => {
  it('says an account exists, with a way to sign in that keeps next', async () => {
    const user = userEvent.setup();
    renderSignup('/signup?next=%2Fstats');

    await user.type(firstNameInput(), 'Marine');
    await user.type(emailInput(), FAKE_CREDENTIALS.email);
    await user.type(passwordInput(), `${GOOD_PASSWORD}{Enter}`);

    expect(await screen.findByText(/Un compte existe déjà avec cet e-mail/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Se connecter' }).getAttribute('href')).toBe(
      '/login?next=%2Fstats',
    );
    await waitFor(() => expect(document.activeElement).toBe(emailInput()));

    // Another e-mail: the message no longer applies.
    await user.type(emailInput(), 'x');
    expect(screen.queryByText(/Un compte existe déjà/)).toBeNull();
  });

  it('marks a common password, until it is changed', async () => {
    const user = userEvent.setup();
    renderSignup('/signup', {
      authClient: refusing({
        code: 'validation-failed',
        fieldErrors: { password: ['compromised'] },
      }),
    });

    await fill(user, `${GOOD_PASSWORD}{Enter}`);

    expect(
      await screen.findByText('Ce mot de passe est trop courant. Choisis-en un autre.'),
    ).toBeTruthy();
    expect(criterion(/Pas un mot de passe courant/).getAttribute('data-state')).toBe('failed');
    await waitFor(() => expect(document.activeElement).toBe(passwordInput()));

    await user.type(passwordInput(), '!');
    expect(criterion(/Pas un mot de passe courant/).getAttribute('data-state')).toBe('pending');
    expect(screen.queryByText(/trop courant/)).toBeNull();
  });

  it.each([
    [
      { password: ['contains-identity'] },
      'Ton mot de passe ne doit pas contenir ton e-mail, ton prénom ni ton nom.',
    ],
    [{ password: ['too-long'] }, '128 caractères maximum.'],
    [{ firstName: ['too-long'] }, 'Saisis un prénom de 1 à 40 caractères.'],
  ])('says the API refusal %o on its field', async (fieldErrors, message) => {
    const user = userEvent.setup();
    renderSignup('/signup', { authClient: refusing({ code: 'validation-failed', fieldErrors }) });

    await fill(user, `${GOOD_PASSWORD}{Enter}`);

    expect(await screen.findByText(message)).toBeTruthy();
  });

  it('says the sign-up is closed when the API does', async () => {
    const user = userEvent.setup();
    renderSignup('/signup', {
      authClient: createFakeAuthClient({ session: null, registrationOpen: false }),
    });

    await fill(user, `${GOOD_PASSWORD}{Enter}`);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Les inscriptions ne sont pas encore ouvertes.',
    );
  });

  it('counts down a throttling', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderSignup('/signup', {
      authClient: refusing({ code: 'too-many-attempts', retryAfterS: 120 }),
    });

    await fill(user, `${GOOD_PASSWORD}{Enter}`);

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Trop de tentatives. Réessaie dans 2 min.',
    );
    const button = screen.getByRole('button', { name: /Créer mon carnet/ });
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.textContent).toContain('2:00');
  });
});
