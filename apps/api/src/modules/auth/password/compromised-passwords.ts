import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/*
 * Local list of compromised passwords (D35: no call to HIBP).
 *
 * Data: `compromised-passwords.txt`, next to this file, one entry per line. It is a filtered extract
 * of SecLists (https://github.com/danielmiessler/SecLists), file
 * `Passwords/Common-Credentials/xato-net-10-million-passwords-1000000.txt` at commit
 * `c205c36a445bff37f8e58a9ec829105cd4975c58` (upstream file SHA-256
 * `424a3e03a17df0a2bc2b3ca749d81b04e79d59cb7aeec8876a5a3f308d0caf51`).
 * MIT License, Copyright (c) 2018 Daniel Miessler: full text in `compromised-passwords.LICENSE`,
 * shipped with the data (both are Nest CLI assets, see `nest-cli.json`).
 *
 * Filter rule (the same normalisation as `toComparablePassword`): each upstream line is turned into
 * `value.normalize('NFKC').toLowerCase()`, kept when it has 15 to 128 code points (shorter ones
 * are refused by the length rule anyway) and no control or format character (`\p{Cc}`, `\p{Cf}`),
 * then deduplicated and sorted. Result: 10 898 entries, all ASCII, file SHA-256
 * `cbdc28a68ea4bc20d214755fb333d816c55ceada6cc3da3bd9b70ecea42aead0`.
 *
 * The list is static: refresh it at each major version (docs/plans/auth.md §8), with the same rule,
 * and update the commit and hashes above.
 *
 * Format: a plain `.txt` asset rather than a generated TS module, so that the data stays diffable
 * against upstream, is neither linted nor formatted, and costs nothing to the TypeScript compiler.
 */
export const COMPROMISED_PASSWORDS_FILE = join(__dirname, 'compromised-passwords.txt');

/** Comparison form of a password, shared by the list and the policy: NFKC then lower case. */
export function toComparablePassword(password: string): string {
  return password.normalize('NFKC').toLowerCase();
}

/**
 * Reads the list once (at boot) into a `Set` of comparable passwords.
 *
 * @throws {Error} when the list is empty (missing asset, truncated file).
 */
export async function loadCompromisedPasswords(
  file: string = COMPROMISED_PASSWORDS_FILE,
): Promise<ReadonlySet<string>> {
  const content = await readFile(file, 'utf8');
  const list = new Set(content.split(/\r?\n/).filter((line) => line.length > 0));
  if (list.size === 0) {
    // A missing check would silently accept every compromised password: refuse to boot.
    throw new Error('Compromised passwords list is empty');
  }
  return list;
}
