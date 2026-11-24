import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';

/** Cost parameters of Argon2id. `memoryKib` is in KiB, as `crypto.argon2` expects it. */
export interface Argon2idParams {
  readonly memoryKib: number;
  readonly passes: number;
  readonly parallelism: number;
}

/** D35 (OWASP): m = 19 456 KiB, t = 2, p = 1. */
export const PASSWORD_HASH_PARAMS: Argon2idParams = {
  memoryKib: 19_456,
  passes: 2,
  parallelism: 1,
};

const ARGON2_VERSION = 19;
const SALT_BYTES = 16;
const TAG_BYTES = 32;

// Bounds of what `verify` accepts from a stored hash, so that a corrupted row can neither exhaust
// the memory nor block the thread pool. The memory is capped relative to the current cost (8 ×:
// 152 MiB with D35), which leaves room for older or stronger parameters but never 1 GiB.
const MAX_MEMORY_FACTOR = 8;
const MAX_PASSES = 16;
const MAX_PARALLELISM = 16;
const MIN_SALT_BYTES = 8;
const MIN_TAG_BYTES = 16;
const MAX_TAG_BYTES = 64;

/** Digits without leading zero: one canonical form per number. */
const PHC_NUMBER = '(0|[1-9][0-9]{0,9})';
const PHC_B64 = '([A-Za-z0-9+/]+)';
const PHC_PATTERN = new RegExp(
  `^\\$argon2id\\$v=${ARGON2_VERSION}\\$m=${PHC_NUMBER},t=${PHC_NUMBER},p=${PHC_NUMBER}\\$${PHC_B64}\\$${PHC_B64}$`,
);

interface ParsedHash {
  readonly params: Argon2idParams;
  readonly salt: Buffer;
  readonly tag: Buffer;
}

/** Outcome of `PasswordHasher.check`. */
export type PasswordCheck = 'match' | 'mismatch' | 'malformed-hash';

/** A stored hash that is not a well-formed Argon2id PHC string: a server-side invariant broken. */
export class MalformedPasswordHashError extends Error {
  constructor() {
    super('Malformed password hash');
    this.name = MalformedPasswordHashError.name;
  }
}

/**
 * Argon2id password hashing with native `node:crypto` (D35), stored as a PHC string
 * `$argon2id$v=19$m=…,t=…,p=…$<salt>$<tag>` (standard base64 without padding).
 *
 * Only the asynchronous `crypto.argon2` is used (libuv thread pool): the event loop is never
 * blocked. Passwords are NFKC-normalised before hashing (NIST 800-63B), like the policy measures
 * them, so the same password typed on another keyboard or OS still matches.
 *
 * Built by `PasswordHasher.create()`, which computes once the dummy hash verified when the email is
 * unknown: a sign-in costs the same work whether the account exists or not.
 */
export class PasswordHasher {
  private constructor(
    private readonly params: Argon2idParams,
    private readonly dummyHash: string,
  ) {}

  static async create(params: Argon2idParams = PASSWORD_HASH_PARAMS): Promise<PasswordHasher> {
    const dummyHash = await hashWith(params, randomBytes(32).toString('base64url'));
    return new PasswordHasher(params, dummyHash);
  }

  hash(password: string): Promise<string> {
    return hashWith(this.params, password);
  }

  /**
   * `verify` for a login: a malformed stored hash (corrupted row) is not a 500 but a failure, after
   * the same work as a real verification (dummy hash).
   */
  async check(password: string, storedHash: string): Promise<PasswordCheck> {
    try {
      return (await this.verify(password, storedHash)) ? 'match' : 'mismatch';
    } catch (error) {
      if (!(error instanceof MalformedPasswordHashError)) {
        throw error;
      }
      await this.verifyDummy(password);
      return 'malformed-hash';
    }
  }

  /**
   * Constant-time comparison of the derived tag.
   *
   * @throws {MalformedPasswordHashError} when `storedHash` is not a well-formed PHC string.
   */
  async verify(password: string, storedHash: string): Promise<boolean> {
    const parsed = parsePhc(storedHash, this.maxMemoryKib);
    if (parsed === null) {
      throw new MalformedPasswordHashError();
    }
    const derived = await deriveTag(password, parsed.salt, parsed.params, parsed.tag.length);
    return timingSafeEqual(derived, parsed.tag);
  }

  private get maxMemoryKib(): number {
    return MAX_MEMORY_FACTOR * this.params.memoryKib;
  }

  /** Same work as a real `verify`, against the boot-time dummy hash; always `false`. */
  async verifyDummy(password: string): Promise<false> {
    await this.verify(password, this.dummyHash);
    return false;
  }

  /** True when the stored hash was made with other parameters (or is unreadable): rehash at login. */
  needsRehash(storedHash: string): boolean {
    const parsed = parsePhc(storedHash, this.maxMemoryKib);
    return (
      parsed === null ||
      parsed.params.memoryKib !== this.params.memoryKib ||
      parsed.params.passes !== this.params.passes ||
      parsed.params.parallelism !== this.params.parallelism ||
      parsed.salt.length !== SALT_BYTES ||
      parsed.tag.length !== TAG_BYTES
    );
  }
}

async function hashWith(params: Argon2idParams, password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const tag = await deriveTag(password, salt, params, TAG_BYTES);
  return formatPhc(params, salt, tag);
}

/** Promise wrapper of the callback-only `crypto.argon2`. */
function deriveTag(
  password: string,
  salt: Buffer,
  params: Argon2idParams,
  tagLength: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2(
      'argon2id',
      {
        message: Buffer.from(password.normalize('NFKC'), 'utf8'),
        nonce: salt,
        memory: params.memoryKib,
        passes: params.passes,
        parallelism: params.parallelism,
        tagLength,
      },
      (error, derivedKey) => {
        if (error === null) {
          resolve(derivedKey);
        } else {
          reject(error);
        }
      },
    );
  });
}

function formatPhc(params: Argon2idParams, salt: Buffer, tag: Buffer): string {
  return `$argon2id$v=${ARGON2_VERSION}$m=${params.memoryKib},t=${params.passes},p=${params.parallelism}$${toB64(salt)}$${toB64(tag)}`;
}

/** Strict parsing: a single accepted form, parameters within bounds, canonical base64. */
function parsePhc(phc: string, maxMemoryKib: number): ParsedHash | null {
  const match = PHC_PATTERN.exec(phc);
  if (match === null) {
    return null;
  }
  const [, memory, passes, parallelism, salt, tag] = match;
  if (
    memory === undefined ||
    passes === undefined ||
    parallelism === undefined ||
    salt === undefined ||
    tag === undefined
  ) {
    return null;
  }
  const params: Argon2idParams = {
    memoryKib: Number(memory),
    passes: Number(passes),
    parallelism: Number(parallelism),
  };
  const saltBytes = fromCanonicalB64(salt);
  const tagBytes = fromCanonicalB64(tag);
  if (
    saltBytes === null ||
    tagBytes === null ||
    !areSupported(params, maxMemoryKib) ||
    saltBytes.length < MIN_SALT_BYTES ||
    tagBytes.length < MIN_TAG_BYTES ||
    tagBytes.length > MAX_TAG_BYTES
  ) {
    return null;
  }
  return { params, salt: saltBytes, tag: tagBytes };
}

function areSupported(
  { memoryKib, passes, parallelism }: Argon2idParams,
  maxMemoryKib: number,
): boolean {
  return (
    parallelism >= 1 &&
    parallelism <= MAX_PARALLELISM &&
    passes >= 1 &&
    passes <= MAX_PASSES &&
    // Argon2 requires at least 8 KiB per lane.
    memoryKib >= 8 * parallelism &&
    memoryKib <= maxMemoryKib
  );
}

function toB64(bytes: Buffer): string {
  return bytes.toString('base64').replace(/=+$/, '');
}

/** `Buffer.from(…, 'base64')` is lenient: only the form `toB64` would write is accepted. */
function fromCanonicalB64(value: string): Buffer | null {
  const bytes = Buffer.from(value, 'base64');
  return toB64(bytes) === value ? bytes : null;
}
