import { describe, expect, it } from 'vitest';
import { isHealthResponse } from './healthApi';

const valid = { status: 'ok', database: 'up', timestamp: '2026-11-06T12:00:00.000Z' };

describe('isHealthResponse', () => {
  it('accepts a body matching the contract', () => {
    expect(isHealthResponse(valid)).toBe(true);
    expect(isHealthResponse({ ...valid, status: 'degraded', database: 'down' })).toBe(true);
  });

  it.each([
    ['null', null],
    ['an array', [valid]],
    ['an unknown status', { ...valid, status: 'ko' }],
    ['an unknown database status', { ...valid, database: 'unknown' }],
    ['a missing timestamp', { status: 'ok', database: 'up' }],
    ['an invalid timestamp', { ...valid, timestamp: 'yesterday' }],
  ])('rejects %s', (_label, body) => {
    expect(isHealthResponse(body)).toBe(false);
  });
});
