import { describe, expect, it } from 'vitest';
import { currentPasswordError, emailError, firstNameError } from './authValidation';

describe('emailError', () => {
  it('asks for an e-mail, then a valid one', () => {
    expect(emailError('  ')).toBe('Saisis ton adresse e-mail.');
    expect(emailError('marine@')).toMatch(/adresse e-mail valide/);
    expect(emailError(' marine@exemple.fr ')).toBeNull();
  });
});

describe('firstNameError', () => {
  it('needs 1 to 40 characters', () => {
    expect(firstNameError(' ')).toBe('Saisis ton prénom.');
    expect(firstNameError('M')).toBeNull();
    expect(firstNameError('a'.repeat(41))).toBe('40 caractères maximum.');
  });
});

describe('currentPasswordError', () => {
  it('only needs a password to try', () => {
    expect(currentPasswordError('')).toBe('Saisis ton mot de passe.');
    expect(currentPasswordError('court')).toBeNull();
  });
});
