/** Source of the current instant, injected so that expiries and rate limits can be tested. */
export interface Clock {
  now(): Date;
}

/** Injection token of the `Clock`. */
export const CLOCK = Symbol('CLOCK');

export const systemClock: Clock = { now: () => new Date() };

/**
 * Monotonic milliseconds (arbitrary origin) for durations: unaffected by a change of the wall
 * clock (NTP step, manual change). Not an instant: never store it nor compare it to a `Date`.
 */
export interface MonotonicClock {
  nowMs(): number;
}

export const monotonicClock: MonotonicClock = { nowMs: () => performance.now() };
