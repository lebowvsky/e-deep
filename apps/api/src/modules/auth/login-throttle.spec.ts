import { createHash } from 'node:crypto';
import { inspect } from 'node:util';
import { LOGIN_THROTTLE_RULES, LoginThrottle } from './login-throttle';

const RULES = {
  ip: { capacity: 4, refillIntervalMs: 10_000 },
  email: { capacity: 2, refillIntervalMs: 60_000 },
};

describe('LoginThrottle', () => {
  let throttle: LoginThrottle;

  beforeEach(() => {
    // Fakes `performance.now()` too: the default monotonic clock follows the fake timers.
    jest.useFakeTimers();
    throttle = new LoginThrottle({ rules: RULES });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('lets a burst through then refuses with the wait until the next token', () => {
    const attempt = { ip: '203.0.113.7', email: 'marine@example.test' };

    expect(throttle.consume(attempt)).toEqual({ allowed: true });
    expect(throttle.consume(attempt)).toEqual({ allowed: true });
    expect(throttle.consume(attempt)).toEqual({
      allowed: false,
      retryAfterSeconds: 60,
      justThrottled: true,
    });

    jest.advanceTimersByTime(45_000);
    expect(throttle.consume(attempt)).toEqual({
      allowed: false,
      retryAfterSeconds: 15,
      justThrottled: false,
    });

    jest.advanceTimersByTime(15_000);
    expect(throttle.consume(attempt)).toEqual({ allowed: true });
  });

  it('reports the throttled state once per window and key', () => {
    const attempt = { ip: '203.0.113.7', email: 'marine@example.test' };
    throttle.consume(attempt);
    throttle.consume(attempt);

    const flags = [1, 2, 3].map(() => {
      const decision = throttle.consume(attempt);
      return decision.allowed ? null : decision.justThrottled;
    });
    expect(flags).toEqual([true, false, false]);

    // A new window: the bucket refills, drains again, and its next refusal is reported again.
    jest.advanceTimersByTime(120_000);
    throttle.consume(attempt);
    throttle.consume(attempt);
    expect(throttle.consume(attempt)).toMatchObject({ allowed: false, justThrottled: true });
  });

  it('limits an email from any IP, whether the account exists or not', () => {
    const email = 'nobody@example.test';

    throttle.consume({ ip: '203.0.113.1', email });
    throttle.consume({ ip: '203.0.113.2', email });

    expect(throttle.consume({ ip: '203.0.113.3', email }).allowed).toBe(false);
    expect(throttle.consume({ ip: '203.0.113.3', email: 'other@example.test' }).allowed).toBe(true);
  });

  it('limits an IP across emails, independently of the email buckets', () => {
    const ip = '198.51.100.9';
    for (const email of ['a@x.test', 'b@x.test', 'c@x.test', 'd@x.test']) {
      expect(throttle.consume({ ip, email }).allowed).toBe(true);
    }

    expect(throttle.consume({ ip, email: 'e@x.test' })).toEqual({
      allowed: false,
      retryAfterSeconds: 10,
      justThrottled: true,
    });
    // The email buckets still have tokens: another IP gets through.
    expect(throttle.consume({ ip: '198.51.100.10', email: 'a@x.test' }).allowed).toBe(true);
  });

  it('does not consume the other bucket when refusing', () => {
    const email = 'marine@example.test';
    const ip = '192.0.2.1';
    for (const other of ['a@x.test', 'b@x.test', 'c@x.test', 'd@x.test']) {
      throttle.consume({ ip, email: other });
    }

    expect(throttle.consume({ ip, email }).allowed).toBe(false);
    expect(throttle.consume({ ip: '192.0.2.2', email }).allowed).toBe(true);
    expect(throttle.consume({ ip: '192.0.2.3', email }).allowed).toBe(true);
  });

  it('a refused attempt does not increase the size', () => {
    const ip = '192.0.2.1';
    for (const email of ['a@x.test', 'b@x.test', 'c@x.test', 'd@x.test']) {
      throttle.consume({ ip, email });
    }
    const size = throttle.size;

    for (let index = 0; index < 100; index += 1) {
      expect(throttle.consume({ ip, email: `random-${index}@x.test` }).allowed).toBe(false);
    }

    expect(throttle.size).toBe(size);
  });

  it('forgets the buckets once full again (TTL)', () => {
    throttle.consume({ ip: '192.0.2.1', email: 'marine@example.test' });
    expect(throttle.size).toBe(2);

    jest.advanceTimersByTime(60_000);
    throttle.consume({ ip: '192.0.2.2', email: 'lucas@example.test' });

    expect(throttle.size).toBe(2);
  });

  it('caps the map, evicting the least recently used buckets', () => {
    const capped = new LoginThrottle({ rules: RULES, maxKeys: 3 });

    capped.consume({ ip: '192.0.2.1', email: 'a@x.test' });
    capped.consume({ ip: '192.0.2.2', email: 'b@x.test' });

    expect(capped.size).toBe(3);
  });

  it('follows a monotonic clock: a wall-clock jump back does not freeze the buckets', () => {
    let monotonic = 0;
    const local = new LoginThrottle({ rules: RULES, clock: { nowMs: () => monotonic } });
    const attempt = { ip: '192.0.2.1', email: 'marine@example.test' };
    local.consume(attempt);
    local.consume(attempt);

    jest.setSystemTime(new Date('2000-01-01T00:00:00.000Z'));
    monotonic += 60_000;

    expect(local.consume(attempt).allowed).toBe(true);
  });

  it('never keeps the email in clear, nor its bare SHA-256', () => {
    throttle.consume({ ip: '192.0.2.1', email: 'marine@example.test' });

    const dump = inspect(throttle, { depth: 5 });
    expect(dump).not.toContain('marine');
    expect(dump).not.toContain(createHash('sha256').update('marine@example.test').digest('hex'));
  });

  it('documents capacities for both keys', () => {
    expect(LOGIN_THROTTLE_RULES.ip.capacity).toBeGreaterThan(LOGIN_THROTTLE_RULES.email.capacity);
  });
});
