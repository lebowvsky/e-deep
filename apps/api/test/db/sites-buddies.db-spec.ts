import type { DataSource } from 'typeorm';
import {
  BuddyLinkConflictError,
  FullSyncRequiredError,
  IdentifierConflictError,
  InvalidReferenceError,
  SiteInUseError,
} from '../../src/common/errors/domain-errors';
import type { SyncCursor } from '../../src/common/sync/sync.types';
import { Buddy } from '../../src/modules/buddies/buddy.entity';
import { BuddiesService } from '../../src/modules/buddies/buddies.service';
import { DiveSite } from '../../src/modules/dive-sites/dive-site.entity';
import { DiveSitesService } from '../../src/modules/dive-sites/dive-sites.service';
import { DiveBuddy } from '../../src/modules/dives/dive-buddy.entity';
import {
  buddyWrite,
  Fixtures,
  recentPull,
  siteWrite,
  SYNC_SETTINGS_90_DAYS,
} from './support/fixtures';
import { createTestDataSource, resetDatabase } from './support/test-database';

const DAY = 86_400_000;

describe('DiveSitesService and BuddiesService', () => {
  let dataSource: DataSource;
  let fixtures: Fixtures;
  let sites: DiveSitesService;
  let buddies: BuddiesService;

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    fixtures = new Fixtures(dataSource);
    sites = new DiveSitesService(dataSource, SYNC_SETTINGS_90_DAYS);
    buddies = new BuddiesService(dataSource, SYNC_SETTINGS_90_DAYS);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  describe('idempotent upsert without takeover', () => {
    it('creates then updates a site (last write wins)', async () => {
      const diver = await fixtures.diver();
      const write = siteWrite();

      const created = await sites.upsert(diver.id, write, recentPull());
      const updated = await sites.upsert(
        diver.id,
        { ...write, name: 'Renamed', baseUpdatedAt: created.current.updatedAt },
        recentPull(),
      );

      expect(created).toMatchObject({ status: 'applied', current: { ownerId: diver.id } });
      expect(updated).toMatchObject({
        status: 'applied',
        current: { name: 'Renamed', latitude: 43.2 },
      });
      expect(await dataSource.manager.countBy(DiveSite, { id: write.id })).toBe(1);
    });

    it("refuses to upsert another diver's site id", async () => {
      const alice = await fixtures.diver();
      const bob = await fixtures.diver();
      const bobSite = await fixtures.site(bob.id);

      await expect(
        sites.upsert(alice.id, siteWrite({ id: bobSite.id, name: 'Taken' }), recentPull()),
      ).rejects.toThrow(IdentifierConflictError);
      expect(await dataSource.manager.findOneByOrFail(DiveSite, { id: bobSite.id })).toMatchObject({
        ownerId: bob.id,
        name: bobSite.name,
      });
    });

    it("refuses to upsert another diver's buddy id", async () => {
      const alice = await fixtures.diver();
      const bob = await fixtures.diver();
      const bobBuddy = await fixtures.buddy(bob.id);

      await expect(
        buddies.upsert(alice.id, buddyWrite({ id: bobBuddy.id }), recentPull()),
      ).rejects.toThrow(IdentifierConflictError);
    });
  });

  describe('deletion guard (D-12 a)', () => {
    it('rejects reviving a tombstone newer than baseUpdatedAt, accepts an up-to-date restore', async () => {
      const diver = await fixtures.diver();
      const write = siteWrite();
      const created = await sites.upsert(diver.id, write, recentPull());
      await sites.remove(diver.id, write.id);
      const tombstone = await dataSource.manager.findOneByOrFail(DiveSite, { id: write.id });

      const late = await sites.upsert(
        diver.id,
        { ...write, name: 'Late edit', baseUpdatedAt: created.current.updatedAt },
        recentPull(),
      );
      expect(late).toEqual({ status: 'rejected', current: tombstone });
      expect(await dataSource.manager.findOneByOrFail(DiveSite, { id: write.id })).toEqual(
        tombstone,
      );

      const restore = await sites.upsert(
        diver.id,
        { ...write, baseUpdatedAt: tombstone.updatedAt },
        recentPull(),
      );
      expect(restore).toMatchObject({ status: 'applied', current: { deletedAt: null } });
    });

    it('applies the same guard to buddies', async () => {
      const diver = await fixtures.diver();
      const write = buddyWrite();
      await buddies.upsert(diver.id, write, recentPull());
      await buddies.remove(diver.id, write.id);

      await expect(buddies.upsert(diver.id, write, recentPull())).resolves.toMatchObject({
        status: 'rejected',
      });
    });
  });

  it('requires a full sync when the last pull predates the purge horizon', async () => {
    const diver = await fixtures.diver();
    const tooOld = new Date(Date.now() - 91 * DAY);

    await expect(sites.upsert(diver.id, siteWrite(), tooOld)).rejects.toThrow(
      FullSyncRequiredError,
    );
    await expect(buddies.upsert(diver.id, buddyWrite(), tooOld)).rejects.toThrow(
      FullSyncRequiredError,
    );
    expect(await dataSource.manager.count(DiveSite)).toBe(0);
  });

  describe('site deletion', () => {
    it('refuses to delete a site used by a live dive event', async () => {
      const diver = await fixtures.diver();
      const { site } = await fixtures.dive(diver.id);

      await expect(sites.remove(diver.id, site.id)).rejects.toThrow(SiteInUseError);
      await expect(
        sites.upsert(
          diver.id,
          siteWrite({ ...site, deletedAt: new Date(), baseUpdatedAt: site.updatedAt }),
          recentPull(),
        ),
      ).rejects.toThrow(SiteInUseError);
      expect(await dataSource.manager.findOneByOrFail(DiveSite, { id: site.id })).toMatchObject({
        deletedAt: null,
      });
    });

    it('deletes a site whose events are all tombstoned', async () => {
      const diver = await fixtures.diver();
      const site = await fixtures.site(diver.id);
      await fixtures.event(diver.id, site.id, { deletedAt: new Date() });

      await sites.remove(diver.id, site.id);

      const stored = await dataSource.manager.findOneByOrFail(DiveSite, { id: site.id });
      expect(stored.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('buddy deletion', () => {
    it('tombstones the buddy and removes it from its dive teams', async () => {
      const diver = await fixtures.diver();
      const buddy = await fixtures.buddy(diver.id);
      const other = await fixtures.buddy(diver.id);
      const { participation } = await fixtures.dive(diver.id, [buddy.id, other.id]);

      await buddies.remove(diver.id, buddy.id);

      expect(
        (await dataSource.manager.findBy(DiveBuddy, { participationId: participation.id })).map(
          (line) => line.buddyId,
        ),
      ).toEqual([other.id]);
      expect(
        (await dataSource.manager.findOneByOrFail(Buddy, { id: buddy.id })).deletedAt,
      ).toBeInstanceOf(Date);
    });

    it('removes the dive team lines when the tombstone arrives through sync', async () => {
      const diver = await fixtures.diver();
      const buddy = await fixtures.buddy(diver.id);
      await fixtures.dive(diver.id, [buddy.id]);

      await buddies.upsert(
        diver.id,
        buddyWrite({ ...buddy, baseUpdatedAt: buddy.updatedAt, deletedAt: new Date() }),
        recentPull(),
      );

      expect(await dataSource.manager.countBy(DiveBuddy, { buddyId: buddy.id })).toBe(0);
    });
  });

  describe('buddy link', () => {
    it('refuses linking to oneself or to an unknown account', async () => {
      const diver = await fixtures.diver();
      await expect(
        buddies.upsert(diver.id, buddyWrite({ linkedDiverId: diver.id }), recentPull()),
      ).rejects.toThrow(InvalidReferenceError);
      await expect(
        buddies.upsert(
          diver.id,
          buddyWrite({ linkedDiverId: '01900000-0000-7000-8000-000000000000' }),
          recentPull(),
        ),
      ).rejects.toThrow(InvalidReferenceError);
    });

    it('refuses a second live contact linked to the same account', async () => {
      const owner = await fixtures.diver();
      const linked = await fixtures.diver();
      await buddies.upsert(owner.id, buddyWrite({ linkedDiverId: linked.id }), recentPull());

      await expect(
        buddies.upsert(owner.id, buddyWrite({ linkedDiverId: linked.id }), recentPull()),
      ).rejects.toThrow(BuddyLinkConflictError);
    });
  });

  it('pulls by (updated_at, id) cursor, tombstones included, owner only', async () => {
    const diver = await fixtures.diver();
    const other = await fixtures.diver();
    await fixtures.site(other.id);
    const ids: string[] = [];
    for (let index = 0; index < 5; index += 1) {
      ids.push((await sites.upsert(diver.id, siteWrite(), recentPull())).current.id);
    }
    await sites.remove(diver.id, ids[1] ?? '');

    const seen: string[] = [];
    let cursor: SyncCursor | null = null;
    let pages = 0;
    do {
      const page = await sites.pull(diver.id, cursor, 2);
      seen.push(...page.items.map((site) => site.id));
      cursor = page.nextCursor;
      pages += 1;
    } while (cursor !== null && pages < 10);

    expect(seen).toHaveLength(5);
    expect(new Set(seen)).toEqual(new Set(ids));
    // The tombstoned site was updated last: it comes last.
    expect(seen.at(-1)).toBe(ids[1]);
  });
});
