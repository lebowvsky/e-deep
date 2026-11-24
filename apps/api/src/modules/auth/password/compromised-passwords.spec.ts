import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  COMPROMISED_PASSWORDS_FILE,
  loadCompromisedPasswords,
  toComparablePassword,
} from './compromised-passwords';

describe('compromised passwords list', () => {
  let list: ReadonlySet<string>;

  beforeAll(async () => {
    list = await loadCompromisedPasswords();
  });

  it('is the documented extract (count and SHA-256 of the file)', async () => {
    const content = await readFile(COMPROMISED_PASSWORDS_FILE);

    expect(list.size).toBe(10_898);
    expect(createHash('sha256').update(content).digest('hex')).toBe(
      'cbdc28a68ea4bc20d214755fb333d816c55ceada6cc3da3bd9b70ecea42aead0',
    );
  });

  it('only holds comparable entries of 15 to 128 code points', () => {
    for (const entry of list) {
      expect(toComparablePassword(entry)).toBe(entry);
      const length = [...entry].length;
      expect(length >= 15 && length <= 128).toBe(true);
    }
  });
});
