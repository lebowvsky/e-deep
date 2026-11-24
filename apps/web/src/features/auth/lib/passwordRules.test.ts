import { describe, expect, it } from 'vitest';
import { newPasswordError } from './authValidation';
import { passwordLength, strengthSegments, strengthTone } from './passwordRules';

describe('passwordLength', () => {
  it('counts code points after NFKC, as the API does', () => {
    expect(passwordLength('abc')).toBe(3);
    // « é » typed as e + combining accent: one character once composed.
    expect(passwordLength('é')).toBe(1);
    // A full-width letter becomes its ASCII form; an emoji is one code point.
    expect(passwordLength('Ａ')).toBe(1);
    expect(passwordLength('🐠')).toBe(1);
  });
});

describe('newPasswordError (D35: 15 to 128)', () => {
  it.each([
    [14, '15 caractères minimum.'],
    [15, null],
    [128, null],
    [129, '128 caractères maximum.'],
  ])('a password of %i characters → %s', (length, message) => {
    expect(newPasswordError('a'.repeat(length))).toBe(message);
  });

  it('measures emojis as the API does: 15 fish are enough', () => {
    expect(newPasswordError('🐠'.repeat(15))).toBeNull();
  });
});

describe('strength gauge', () => {
  it.each([
    [0, 0],
    [1, 1],
    [7, 1],
    [8, 2],
    [14, 2],
    [15, 3],
    [19, 3],
    [20, 4],
    [60, 4],
  ])('lights, for %i characters, %i segments', (length, segments) => {
    expect(strengthSegments(length)).toBe(segments);
  });

  it('warns below 15 characters, then succeeds', () => {
    expect(strengthTone(14)).toBe('warning');
    expect(strengthTone(15)).toBe('success');
  });
});
