import { describe, expect, it } from 'vitest';
import {
  certificationLevelError,
  currentPasswordError,
  emailError,
  firstNameError,
  healthConsentError,
  lastNameError,
} from './authValidation';

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

describe('the first launch', () => {
  it('lets the last name empty, up to 100 characters', () => {
    expect(lastNameError('')).toBeNull();
    expect(lastNameError('é'.repeat(100))).toBeNull();
    expect(lastNameError('a'.repeat(101))).toBe('100 caractères maximum.');
  });

  it('needs a level and the consent', () => {
    expect(certificationLevelError('')).toBe('Choisis ton niveau.');
    expect(certificationLevelError('ffessm-n2')).toBeNull();
    expect(healthConsentError(false)).toMatch(/^Coche la case pour continuer/);
    expect(healthConsentError(true)).toBeNull();
  });
});
