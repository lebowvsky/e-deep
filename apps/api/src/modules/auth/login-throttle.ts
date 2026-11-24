import { createHmac, randomBytes } from 'node:crypto';
import { monotonicClock, type MonotonicClock } from '../../common/time/clock';

/** A token bucket: `capacity` attempts in a burst, one more every `refillIntervalMs`. */
export interface BucketRule {
  readonly capacity: number;
  readonly refillIntervalMs: number;
}

/** One rule per key kind. */
export type ThrottleRules = Readonly<Record<'ip' | 'email', BucketRule>>;

/**
 * Capacities (D35). Per IP: a burst of 30, then one every 20 s (180 an hour), loose enough for a
 * club behind one NAT. Per email: a burst of 5, then one every 2 minutes (30 an hour), which keeps
 * an online guess of a single account negligible against a 15-character password.
 */
export const LOGIN_THROTTLE_RULES = {
  ip: { capacity: 30, refillIntervalMs: 20_000 },
  email: { capacity: 5, refillIntervalMs: 120_000 },
} as const satisfies ThrottleRules;

/**
 * Most buckets kept in memory (a few MB). Beyond it, the least recently used bucket is evicted
 * rather than refusing every attempt: failing closed would let anyone with enough IPs lock every
 * diver out. Eviction only gives a fresh bucket back to a key idle for longest, and filling the
 * map requires attempts that are themselves limited per IP.
 */
export const LOGIN_THROTTLE_MAX_KEYS = 100_000;

/** Buckets inspected per attempt to forget the full ones: bounded work, no timer. */
const SWEEP_BATCH = 32;

export interface ThrottleAttempt {
  readonly ip: string;
  /** Normalised email (`normalizeEmail`); keyed by an HMAC, never kept in clear. */
  readonly email: string;
}

export type ThrottleDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly retryAfterSeconds: number;
      /** `true` on the first refusal since a key ran dry: trace `login_throttled` once per window. */
      readonly justThrottled: boolean;
    };

export interface LoginThrottleOptions {
  readonly clock?: MonotonicClock;
  readonly rules?: ThrottleRules;
  readonly maxKeys?: number;
}

/** Stored state of a bucket that is not full; a full bucket has no entry. */
interface BucketState {
  readonly tokens: number;
  readonly updatedAtMs: number;
  /** A refusal was already reported since the bucket ran dry. */
  readonly throttleReported: boolean;
}

interface BucketView {
  readonly key: string;
  readonly rule: BucketRule;
  readonly tokens: number;
  readonly stored: BucketState | undefined;
}

/**
 * In-memory rate limit of the password attempts (D35): two independent token buckets, keyed
 * `ip:<ip>` and `email:<HMAC-SHA256 of the normalised email>` (random key per process: the map
 * cannot be reversed with a dictionary of emails), counted whether the account exists or not (a
 * `429` reveals nothing). An attempt goes through only when both buckets have a token, and then
 * consumes one from each.
 *
 * Only drained buckets are stored, and only by an allowed attempt: a refused one never adds an
 * entry. A bucket is forgotten once full again (incremental sweep), and the map is capped
 * (`LOGIN_THROTTLE_MAX_KEYS`, LRU eviction). Time is monotonic. Single instance only, reset by a
 * restart: accepted debt (docs/plans/auth.md §8). Never logs a key.
 */
export class LoginThrottle {
  /** Insertion order = least recently updated first (an update re-inserts). */
  private readonly buckets = new Map<string, BucketState>();
  private readonly hmacKey = randomBytes(32);
  private readonly clock: MonotonicClock;
  private readonly rules: ThrottleRules;
  private readonly maxKeys: number;

  constructor({
    clock = monotonicClock,
    rules = LOGIN_THROTTLE_RULES,
    maxKeys = LOGIN_THROTTLE_MAX_KEYS,
  }: LoginThrottleOptions = {}) {
    this.clock = clock;
    this.rules = rules;
    this.maxKeys = maxKeys;
  }

  consume({ ip, email }: ThrottleAttempt): ThrottleDecision {
    const nowMs = this.clock.nowMs();
    this.sweep(nowMs);
    const views = [
      this.view(`ip:${ip}`, this.rules.ip, nowMs),
      this.view(`email:${this.emailDigest(email)}`, this.rules.email, nowMs),
    ];
    const empty = views.filter((view) => view.tokens < 1);
    if (empty.length > 0) {
      return this.refuse(empty, nowMs);
    }
    for (const view of views) {
      this.store(view.key, {
        tokens: view.tokens - 1,
        updatedAtMs: nowMs,
        throttleReported: false,
      });
    }
    return { allowed: true };
  }

  /** Number of buckets kept in memory (tests, monitoring). */
  get size(): number {
    return this.buckets.size;
  }

  /** Only existing (drained) buckets are touched: a refusal never grows the map. */
  private refuse(empty: readonly BucketView[], nowMs: number): ThrottleDecision {
    let justThrottled = false;
    for (const { key, tokens, stored } of empty) {
      if (stored !== undefined && !stored.throttleReported) {
        justThrottled = true;
        this.store(key, { tokens, updatedAtMs: nowMs, throttleReported: true });
      }
    }
    const waitMs = Math.max(...empty.map((view) => (1 - view.tokens) * view.rule.refillIntervalMs));
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
      justThrottled,
    };
  }

  /** The bucket of `key` refilled up to now, without storing anything (absent = full). */
  private view(key: string, rule: BucketRule, nowMs: number): BucketView {
    const stored = this.buckets.get(key);
    return {
      key,
      rule,
      stored,
      tokens: stored === undefined ? rule.capacity : refilled(stored, rule, nowMs),
    };
  }

  private store(key: string, state: BucketState): void {
    this.buckets.delete(key);
    this.buckets.set(key, state);
    while (this.buckets.size > this.maxKeys) {
      const oldest = this.buckets.keys().next();
      if (oldest.done === true) {
        break;
      }
      this.buckets.delete(oldest.value);
    }
  }

  /** Forgets the full buckets among the least recently updated ones; bounded per call. */
  private sweep(nowMs: number): void {
    let inspected = 0;
    for (const [key, state] of this.buckets) {
      if (inspected === SWEEP_BATCH) {
        return;
      }
      inspected += 1;
      const rule = key.startsWith('ip:') ? this.rules.ip : this.rules.email;
      if (refilled(state, rule, nowMs) >= rule.capacity) {
        this.buckets.delete(key);
      }
    }
  }

  private emailDigest(email: string): string {
    return createHmac('sha256', this.hmacKey).update(email, 'utf8').digest('hex');
  }
}

function refilled(state: BucketState, rule: BucketRule, nowMs: number): number {
  const elapsedMs = Math.max(0, nowMs - state.updatedAtMs);
  return Math.min(rule.capacity, state.tokens + elapsedMs / rule.refillIntervalMs);
}
