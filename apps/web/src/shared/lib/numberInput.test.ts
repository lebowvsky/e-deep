import { describe, expect, it } from 'vitest';
import { normalizeNumberInput, parseNumberInput } from './numberInput';

describe('normalizeNumberInput', () => {
  const decimal = { decimal: true, signed: false };
  const integer = { decimal: false, signed: false };

  it('writes the decimal separator as a French comma and keeps only one', () => {
    expect(normalizeNumberInput('12.5', decimal)).toBe('12,5');
    expect(normalizeNumberInput('1,2,3', decimal)).toBe('1,23');
  });

  it('keeps digits only in an integer field', () => {
    expect(normalizeNumberInput('12,5 m', integer)).toBe('125');
  });

  it('keeps a leading minus sign only when signed', () => {
    expect(normalizeNumberInput('-2', { decimal: true, signed: true })).toBe('-2');
    expect(normalizeNumberInput('-2', decimal)).toBe('2');
    expect(normalizeNumberInput('2-', { decimal: true, signed: true })).toBe('2');
  });
});

describe('parseNumberInput', () => {
  it('reads a French decimal', () => {
    expect(parseNumberInput('12,5')).toBe(12.5);
    expect(parseNumberInput('-2')).toBe(-2);
  });

  it('returns null for an empty or incomplete value', () => {
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('-')).toBeNull();
  });
});
