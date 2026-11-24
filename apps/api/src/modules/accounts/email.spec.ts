import { DomainValidationError } from '../../common/errors/domain-errors';
import { normalizeEmail } from './email';

describe('normalizeEmail', () => {
  it('trims and lower-cases, as lower(btrim(email)) does', () => {
    expect(normalizeEmail('  Marine.Rousseau@Example.TEST \n')).toBe(
      'marine.rousseau@example.test',
    );
  });

  it.each<[string, string, string]>([
    ['a non-ASCII character', 'marine@exämple.test', 'invalid-character'],
    ['a Unicode case fold', 'MARİNE@example.test', 'invalid-character'],
    ['an inner space', 'marine rousseau@example.test', 'invalid-character'],
    ['a control character', 'marine\u0000@example.test', 'invalid-character'],
    ['an empty value', '   ', 'length'],
    ['a too short value', 'a@', 'length'],
    ['a too long value', `${'a'.repeat(250)}@b.cd`, 'length'],
    ['no @', 'marine.example.test', 'format'],
    ['a leading @', '@example.test', 'format'],
  ])('refuses %s with a field code only', (_label, raw, code) => {
    let caught: unknown;
    try {
      normalizeEmail(raw);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DomainValidationError);
    expect(caught).toMatchObject({ fieldErrors: { email: [code] } });
  });
});
