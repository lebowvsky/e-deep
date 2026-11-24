import { DomainValidationError } from '../../../common/errors/domain-errors';
import { PasswordPolicy, type PasswordIdentity } from './password-policy';

const COMPROMISED = new Set(['iloveyouforever123', 'qwertyuiopasdfgh']);
const IDENTITY: PasswordIdentity = {
  email: 'marine.rousseau@example.test',
  firstName: 'Marine',
  lastName: 'Le Goff-Durand',
};
const NO_NAME: PasswordIdentity = { email: 'zz@example.test', firstName: 'Al', lastName: null };

describe('PasswordPolicy', () => {
  const policy = new PasswordPolicy(COMPROMISED);
  const check = (candidate: string, identity: PasswordIdentity = NO_NAME) =>
    policy.check(candidate, identity);

  describe('length (15 to 128 code points after NFKC)', () => {
    it.each<[number, string[]]>([
      [14, ['too-short']],
      [15, []],
      [128, []],
      [129, ['too-long']],
    ])('%i characters → %j', (length, failures) => {
      expect(check('k'.repeat(length))).toEqual(failures);
    });

    it('counts code points, not UTF-16 units', () => {
      // 15 emoji = 30 UTF-16 units.
      expect(check('🐠'.repeat(15))).toEqual([]);
      expect(check('🐠'.repeat(14))).toEqual(['too-short']);
    });

    it('counts after NFKC: a decomposed accent is one character', () => {
      const decomposed = 'é'; // « é » as 2 code points, 1 after NFKC
      expect(check(decomposed.repeat(15))).toEqual([]);
      expect(check(decomposed.repeat(14))).toEqual(['too-short']);
    });

    it('has no composition rule', () => {
      expect(check('only lower case words here')).toEqual([]);
    });
  });

  describe('compromised list', () => {
    it('refuses a listed password, whatever its case', () => {
      expect(check('ILoveYouForever123')).toEqual(['compromised']);
    });

    it('compares the NFKC form: full-width letters do not escape the list', () => {
      expect(check('ｑｗｅｒｔｙuiopasdfgh')).toEqual(['compromised']);
    });

    it('accepts a password that only contains a listed one', () => {
      expect(check('iloveyouforever123 and more')).toEqual([]);
    });
  });

  describe('identity', () => {
    it.each([
      ['the full email', 'my-marine.rousseau@example.test-pw'],
      ['the local part of the email', 'xx-MARINE.ROUSSEAU-xx-long'],
      ['the first name', 'deep blue marine diver'],
      ['a part of a compound last name', 'all the goff family dives'],
      ['a full-width name (NFKC)', 'diving with the ｇｏｆｆ friends'],
    ])('refuses a password containing %s', (_label, candidate) => {
      expect(policy.check(candidate, IDENTITY)).toEqual(['contains-identity']);
    });

    it('ignores fragments shorter than 3 characters', () => {
      expect(check('always a long passphrase zz')).toEqual([]);
    });

    it('accepts a password without the identity', () => {
      expect(policy.check('coral reef at dawn', IDENTITY)).toEqual([]);
    });
  });

  it('reports every broken rule', () => {
    expect(policy.check('marine', IDENTITY)).toEqual(['too-short', 'contains-identity']);
  });

  it('throws a validation error on the given field, codes only', () => {
    let caught: unknown;
    try {
      policy.assertAcceptable('ILoveYouForever123', NO_NAME, 'newPassword');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(DomainValidationError);
    expect(caught).toMatchObject({ fieldErrors: { newPassword: ['compromised'] } });
    expect(String((caught as Error).message)).not.toContain('ILoveYou');
    expect(() => policy.assertAcceptable('coral reef at dawn', IDENTITY, 'password')).not.toThrow();
  });
});
