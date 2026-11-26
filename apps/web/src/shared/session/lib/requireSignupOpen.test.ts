import { describe, expect, it } from 'vitest';
import { requireSignupOpen } from './requireSignupOpen';

const at = (url: string) => ({ request: new Request(`http://localhost${url}`) });

describe('requireSignupOpen', () => {
  it('lets the sign-up page show while the sign-up is open', () => {
    expect(requireSignupOpen({ signup: true })(at('/signup'))).toBeNull();
  });

  it('sends the closed beta to /login, with the same query', () => {
    const response = requireSignupOpen({ signup: false })(at('/signup?next=%2Fdives'));

    expect(response?.status).toBe(302);
    expect(response?.headers.get('Location')).toBe('/login?next=%2Fdives');
  });
});
