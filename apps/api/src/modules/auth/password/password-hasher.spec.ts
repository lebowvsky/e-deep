import {
  MalformedPasswordHashError,
  PASSWORD_HASH_PARAMS,
  PasswordHasher,
} from './password-hasher';

/** Cheap parameters: the tests check the logic, not the cost. */
const FAST = { memoryKib: 64, passes: 1, parallelism: 1 };
const PASSWORD = 'correct horse battery staple';

describe('PasswordHasher', () => {
  let hasher: PasswordHasher;

  beforeAll(async () => {
    hasher = await PasswordHasher.create(FAST);
  });

  it('round-trips a password through a PHC string', async () => {
    const hash = await hasher.hash(PASSWORD);

    expect(hash).toMatch(/^\$argon2id\$v=19\$m=64,t=1,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/);
    await expect(hasher.verify(PASSWORD, hash)).resolves.toBe(true);
    await expect(hasher.verify(`${PASSWORD}!`, hash)).resolves.toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hasher.hash(PASSWORD)).not.toBe(await hasher.hash(PASSWORD));
  });

  it('verifies the NFKC form of the password', async () => {
    const hash = await hasher.hash('ｃｏｒｒｅｃｔ horse battery'); // full-width letters

    await expect(hasher.verify('correct horse battery', hash)).resolves.toBe(true);
  });

  it('hashes with the D35 parameters by default', async () => {
    const real = await PasswordHasher.create();
    const hash = await real.hash(PASSWORD);

    expect(PASSWORD_HASH_PARAMS).toEqual({ memoryKib: 19_456, passes: 2, parallelism: 1 });
    expect(hash.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true);
    await expect(real.verify(PASSWORD, hash)).resolves.toBe(true);
    expect(real.needsRehash(hash)).toBe(false);
  });

  it('asks for a rehash when the parameters differ', async () => {
    const stronger = await PasswordHasher.create({ ...FAST, passes: 2 });
    const hash = await hasher.hash(PASSWORD);

    expect(hasher.needsRehash(hash)).toBe(false);
    expect(stronger.needsRehash(hash)).toBe(true);
    // An old hash still verifies with the new parameters: it is read from the PHC string.
    await expect(stronger.verify(PASSWORD, hash)).resolves.toBe(true);
  });

  it('verifies the dummy hash, always failing', async () => {
    await expect(hasher.verifyDummy(PASSWORD)).resolves.toBe(false);
  });

  describe('strict PHC parsing', () => {
    let valid: string;

    beforeAll(async () => {
      valid = await hasher.hash(PASSWORD);
    });

    it.each<[string, (hash: string) => string]>([
      ['another algorithm', (hash) => hash.replace('$argon2id$', '$argon2i$')],
      ['another version', (hash) => hash.replace('$v=19$', '$v=16$')],
      ['a missing version', (hash) => hash.replace('$v=19', '')],
      ['reordered parameters', (hash) => hash.replace('m=64,t=1,p=1', 't=1,m=64,p=1')],
      ['a leading zero', (hash) => hash.replace('m=64', 'm=064')],
      ['a padded salt', (hash) => hash.replace(/\$([^$]+)\$([^$]+)$/, '$$$1==$$$2')],
      [
        'a non-canonical base64',
        (hash) => hash.replace(/.$/, (last) => (last === 'B' ? 'C' : 'B')),
      ],
      ['a URL-safe alphabet', (hash) => hash.replace(/\$([^$]+)$/, '$$-_-_-_-_-_-_-_-_-_-_-_-_')],
      ['a missing tag', (hash) => hash.replace(/\$[^$]+$/, '')],
      ['trailing data', (hash) => `${hash}$`],
      ['too much memory', (hash) => hash.replace('m=64', 'm=99999999')],
      ['more than 8 × the current memory', (hash) => hash.replace('m=64', 'm=513')],
      ['zero passes', (hash) => hash.replace('t=1', 't=0')],
      ['a short salt', (hash) => hash.replace(/\$([^$]+)\$([^$]+)$/, '$$c2FsdA$$$2')],
    ])('refuses %s', async (_label, corrupt) => {
      const malformed = corrupt(valid);
      expect(malformed).not.toBe(valid);

      await expect(hasher.verify(PASSWORD, malformed)).rejects.toThrow(MalformedPasswordHashError);
      expect(hasher.needsRehash(malformed)).toBe(true);
    });

    it('check answers malformed-hash after the dummy work, instead of throwing', async () => {
      const dummy = jest.spyOn(hasher, 'verifyDummy');

      await expect(hasher.check(PASSWORD, 'plain-text-secret')).resolves.toBe('malformed-hash');
      expect(dummy).toHaveBeenCalledWith(PASSWORD);
      await expect(hasher.check(PASSWORD, valid)).resolves.toBe('match');
      await expect(hasher.check('wrong one', valid)).resolves.toBe('mismatch');
      dummy.mockRestore();
    });

    it('refuses a non-PHC value without echoing it', async () => {
      await expect(hasher.verify(PASSWORD, 'plain-text-secret')).rejects.toThrow(
        'Malformed password hash',
      );
    });
  });
});
