import { FullSyncRequiredError } from '../errors/domain-errors';
import { assertWithinPurgeHorizon, isStaleRestore, purgeHorizonStart } from './sync-rules';

const NOW = new Date('2026-11-08T12:00:00.000Z');
const DAY = 86_400_000;

describe('purge horizon', () => {
  it('starts horizonDays before now', () => {
    expect(purgeHorizonStart(NOW, 90)).toEqual(new Date(NOW.getTime() - 90 * DAY));
  });

  it('accepts a last pull within the horizon, boundary included', () => {
    expect(() => assertWithinPurgeHorizon(new Date(NOW.getTime() - DAY), NOW, 90)).not.toThrow();
    expect(() => assertWithinPurgeHorizon(purgeHorizonStart(NOW, 90), NOW, 90)).not.toThrow();
  });

  it('requires a full sync when the last pull is older than the horizon', () => {
    const lastPulledAt = new Date(purgeHorizonStart(NOW, 90).getTime() - 1);
    expect(() => assertWithinPurgeHorizon(lastPulledAt, NOW, 90)).toThrow(FullSyncRequiredError);
  });
});

describe('isStaleRestore', () => {
  const tombstonedAt = new Date('2026-11-01T10:00:00.000Z');
  const tombstone = { updatedAt: tombstonedAt, deletedAt: tombstonedAt };
  const alive = { deletedAt: null };

  it('rejects reviving a tombstone the client has not seen', () => {
    const baseUpdatedAt = new Date(tombstonedAt.getTime() - 1);
    expect(isStaleRestore(tombstone, { ...alive, baseUpdatedAt })).toBe(true);
    expect(isStaleRestore(tombstone, { ...alive, baseUpdatedAt: null })).toBe(true);
  });

  it('accepts a restoration based on the tombstone itself', () => {
    expect(isStaleRestore(tombstone, { ...alive, baseUpdatedAt: tombstonedAt })).toBe(false);
  });

  it('ignores live server rows and deletions', () => {
    expect(
      isStaleRestore(
        { updatedAt: tombstonedAt, deletedAt: null },
        { ...alive, baseUpdatedAt: null },
      ),
    ).toBe(false);
    expect(isStaleRestore(tombstone, { baseUpdatedAt: null, deletedAt: tombstonedAt })).toBe(false);
  });
});
