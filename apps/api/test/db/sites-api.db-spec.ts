import { randomUUID } from 'node:crypto';
import type { SiteWriteRequest } from '@e-deep/shared';
import { NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import {
  IdentifierConflictError,
  InvalidReferenceError,
  MergeIntoSelfError,
  SiteInUseError,
} from '../../src/common/errors/domain-errors';
import { asDiverId } from '../../src/common/auth/diver-id';
import { BuddiesService } from '../../src/modules/buddies/buddies.service';
import { DiveSite } from '../../src/modules/dive-sites/dive-site.entity';
import { DiveSitesService } from '../../src/modules/dive-sites/dive-sites.service';
import { DiveEvent } from '../../src/modules/dives/dive-event.entity';
import { DiveLogService } from '../../src/modules/dives/dive-log.service';
import { DiveWriteService } from '../../src/modules/dives/dive-write.service';
import { DivesService } from '../../src/modules/dives/dives.service';
import { diveWriteRequest } from '../support/dive-write-request';
import { siteCreateRequest } from '../support/site-request';
import {
  diveWrite,
  Fixtures,
  recentPull,
  siteWrite,
  SYNC_SETTINGS_90_DAYS,
} from './support/fixtures';
import { updatedAtOf } from './support/sql';
import { createTestDataSource, resetDatabase } from './support/test-database';

/** The replacement body of a creation: everything but the origin. */
function replacementOf(values: Partial<SiteWriteRequest> = {}): SiteWriteRequest {
  const { createdVia: _origin, ...request } = siteCreateRequest(values);
  return request;
}

describe('DiveSitesService: online API (D-33)', () => {
  let dataSource: DataSource;
  let fixtures: Fixtures;
  let sites: DiveSitesService;
  let dives: DivesService;
  let diveWrites: DiveWriteService;
  let diveLog: DiveLogService;

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    fixtures = new Fixtures(dataSource);
    sites = new DiveSitesService(dataSource, SYNC_SETTINGS_90_DAYS);
    dives = new DivesService(dataSource, SYNC_SETTINGS_90_DAYS);
    diveLog = new DiveLogService(dataSource);
    diveWrites = new DiveWriteService(
      dataSource,
      dives,
      sites,
      new BuddiesService(dataSource, SYNC_SETTINGS_90_DAYS),
      diveLog,
    );
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  async function siteRow(id: string): Promise<DiveSite> {
    return dataSource.manager.findOneByOrFail(DiveSite, { id });
  }

  /** A live dive (event + participation) of the diver on the site, tombstoned when asked. */
  async function diveOn(diverId: string, siteId: string, deletedAt: Date | null = null) {
    const event = await fixtures.event(diverId, siteId, { deletedAt });
    await fixtures.participation(event.id, diverId, { deletedAt });
    return event;
  }

  describe('list and findOne', () => {
    it("lists the diver's live sites only, by name then id, with every field", async () => {
      const diver = await fixtures.diver();
      const other = await fixtures.diver();
      const target = await fixtures.site(diver.id, { name: 'Bibliothèque', type: 'tombant' });
      await fixtures.site(diver.id, { name: 'Aiguilles', depthMinM: 10, depthMaxM: 25.5 });
      await fixtures.site(diver.id, { name: 'Supprimé', deletedAt: new Date() });
      await fixtures.site(diver.id, {
        name: 'Fusionné',
        deletedAt: new Date(),
        mergedIntoId: target.id,
      });
      await fixtures.site(other.id, { name: 'Autre plongeur' });

      const { sites: listed } = await sites.list(asDiverId(diver.id));

      expect(listed.map((site) => site.name)).toEqual(['Aiguilles', 'Bibliothèque']);
      expect(listed[0]).toEqual({
        id: expect.any(String) as unknown,
        name: 'Aiguilles',
        locality: null,
        region: 'Côte Bleue',
        area: null,
        latitude: 43.33,
        longitude: 5.25,
        type: null,
        depthMinM: 10,
        depthMaxM: 25.5,
        accessNotes: null,
        createdVia: 'full',
        createdAt: expect.any(String) as unknown,
        updatedAt: expect.any(String) as unknown,
      });
      expect(await sites.list(asDiverId(randomUUID()))).toEqual({ sites: [] });
    });

    it("refuses another diver's site, a deleted, a merged and an unknown one alike", async () => {
      const diver = await fixtures.diver();
      const other = await fixtures.diver();
      const own = await fixtures.site(diver.id);
      const deleted = await fixtures.site(diver.id, { deletedAt: new Date() });
      const merged = await fixtures.site(diver.id, {
        deletedAt: new Date(),
        mergedIntoId: own.id,
      });
      const othersSite = await fixtures.site(other.id);

      await expect(sites.findOne(asDiverId(diver.id), own.id)).resolves.toMatchObject({
        id: own.id,
      });
      for (const id of [deleted.id, merged.id, othersSite.id, randomUUID()]) {
        await expect(sites.findOne(asDiverId(diver.id), id)).rejects.toThrow(NotFoundException);
      }
    });
  });

  describe('create', () => {
    it('creates the site with its origin, then replays the same creation without writing', async () => {
      const diver = await fixtures.diver();
      const request = siteCreateRequest({ createdVia: 'quick', latitude: null, longitude: null });

      const created = await sites.create(asDiverId(diver.id), request);
      const updatedAt = await updatedAtOf(dataSource, 'dive_sites', request.id);
      const replayed = await sites.create(asDiverId(diver.id), request);

      expect(created).toMatchObject({
        outcome: 'created',
        site: { id: request.id, createdVia: 'quick', type: 'tombant', latitude: null },
      });
      expect(replayed).toEqual({ outcome: 'replayed', site: created.site });
      expect(await updatedAtOf(dataSource, 'dive_sites', request.id)).toBe(updatedAt);
    });

    it('serialises two concurrent creations of the same id: one created, one replayed', async () => {
      const diver = await fixtures.diver();
      const request = siteCreateRequest();

      const outcomes = await Promise.all([
        sites.create(asDiverId(diver.id), request),
        sites.create(asDiverId(diver.id), request),
      ]);

      expect(outcomes.map(({ outcome }) => outcome).sort()).toEqual(['created', 'replayed']);
    });

    it("answers identifier-conflict for another content, a deleted site or another diver's id", async () => {
      const diver = await fixtures.diver();
      const other = await fixtures.diver();
      const request = siteCreateRequest();
      await sites.create(asDiverId(diver.id), request);
      const deleted = await fixtures.site(diver.id, { deletedAt: new Date() });
      const othersSite = await fixtures.site(other.id, { name: 'Le sien' });

      await expect(
        sites.create(asDiverId(diver.id), { ...request, accessNotes: 'Autre accès.' }),
      ).rejects.toThrow(IdentifierConflictError);
      await expect(
        sites.create(asDiverId(diver.id), { ...request, createdVia: 'quick' }),
      ).rejects.toThrow(IdentifierConflictError);
      await expect(
        sites.create(
          asDiverId(diver.id),
          siteCreateRequest({ id: deleted.id, name: deleted.name }),
        ),
      ).rejects.toThrow(IdentifierConflictError);
      await expect(
        sites.create(asDiverId(diver.id), siteCreateRequest({ id: othersSite.id })),
      ).rejects.toThrow(IdentifierConflictError);
      expect(await siteRow(othersSite.id)).toMatchObject({ ownerId: other.id, name: 'Le sien' });
    });
  });

  describe('replace', () => {
    it('replaces every field, null included, and keeps the origin (RG-34)', async () => {
      const diver = await fixtures.diver();
      const site = await fixtures.site(diver.id, { createdVia: 'quick', type: 'sec' });

      const replaced = await sites.replace(
        asDiverId(diver.id),
        replacementOf({
          id: site.id,
          name: 'Sec du Sarranier',
          region: null,
          latitude: null,
          longitude: null,
          type: 'epave',
          depthMinM: 15,
          depthMaxM: 32.5,
          accessNotes: null,
        }),
      );

      expect(replaced).toMatchObject({
        id: site.id,
        name: 'Sec du Sarranier',
        region: null,
        latitude: null,
        type: 'epave',
        depthMaxM: 32.5,
        accessNotes: null,
        createdVia: 'quick',
      });
      expect(await siteRow(site.id)).toMatchObject({ createdVia: 'quick', depthMinM: 15 });
    });

    it("answers 404 for an absent, deleted, merged or another diver's site, without writing", async () => {
      const diver = await fixtures.diver();
      const other = await fixtures.diver();
      const target = await fixtures.site(diver.id);
      const deleted = await fixtures.site(diver.id, { deletedAt: new Date() });
      const merged = await fixtures.site(diver.id, {
        deletedAt: new Date(),
        mergedIntoId: target.id,
      });
      const othersSite = await fixtures.site(other.id, { name: 'Le sien' });

      for (const id of [randomUUID(), deleted.id, merged.id, othersSite.id]) {
        await expect(sites.replace(asDiverId(diver.id), replacementOf({ id }))).rejects.toThrow(
          NotFoundException,
        );
      }
      expect(await dataSource.manager.countBy(DiveSite, { ownerId: diver.id })).toBe(3);
      expect(await siteRow(deleted.id)).toMatchObject({ deletedAt: expect.any(Date) as unknown });
      expect(await siteRow(othersSite.id)).toMatchObject({ name: 'Le sien' });
    });
  });

  describe('merge (D-29)', () => {
    async function mergeScenario() {
      const diver = await fixtures.diver();
      const target = await fixtures.site(diver.id, {
        name: 'Pointe de la Revellata',
        createdVia: 'full',
        type: 'tombant',
        depthMinM: null,
        depthMaxM: 60,
        accessNotes: null,
        latitude: null,
        longitude: null,
      });
      const source = await fixtures.site(diver.id, {
        name: 'Revellata',
        createdVia: 'quick',
        locality: 'Calvi',
        area: 'Méditerranée',
        type: 'grotte',
        depthMinM: 12,
        depthMaxM: 30,
        accessNotes: 'Mouillage au phare.',
        latitude: 42.583,
        longitude: 8.725,
      });
      const live = await diveOn(diver.id, source.id);
      const tombstoned = await diveOn(diver.id, source.id, new Date());
      // Merged into the source earlier: must end up pointing to the target (one hop).
      const earlier = await fixtures.site(diver.id, {
        deletedAt: new Date(),
        mergedIntoId: source.id,
      });
      return { diver, target, source, live, tombstoned, earlier };
    }

    it('moves every dive of the source, completes the target and tombstones the source', async () => {
      const { diver, target, source, live, tombstoned, earlier } = await mergeScenario();
      const eventUpdatedAt = await updatedAtOf(dataSource, 'dive_events', live.id);

      const merged = await sites.merge(asDiverId(diver.id), source.id, target.id);

      expect(merged).toMatchObject({
        id: target.id,
        name: 'Pointe de la Revellata',
        createdVia: 'full',
        locality: 'Calvi',
        region: 'Côte Bleue',
        area: 'Méditerranée',
        type: 'tombant',
        // 12 ≤ 60: the minimum is taken from the source, the maximum kept.
        depthMinM: 12,
        depthMaxM: 60,
        accessNotes: 'Mouillage au phare.',
        latitude: 42.583,
        longitude: 8.725,
      });
      expect(await sites.findOne(asDiverId(diver.id), target.id)).toEqual(merged);
      for (const event of [live, tombstoned]) {
        expect(await dataSource.manager.findOneByOrFail(DiveEvent, { id: event.id })).toMatchObject(
          { siteId: target.id },
        );
      }
      expect(await updatedAtOf(dataSource, 'dive_events', live.id)).not.toBe(eventUpdatedAt);
      expect(await siteRow(source.id)).toMatchObject({
        deletedAt: expect.any(Date) as unknown,
        mergedIntoId: target.id,
      });
      expect(await siteRow(earlier.id)).toMatchObject({ mergedIntoId: target.id });
      await expect(sites.findOne(asDiverId(diver.id), source.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lets the name of the site follow the merge in the dive log', async () => {
      const { diver, target, source, live } = await mergeScenario();

      await sites.merge(asDiverId(diver.id), source.id, target.id);

      const { dives: log } = await diveLog.findAll(asDiverId(diver.id));
      expect(log).toEqual([
        expect.objectContaining({
          id: live.id,
          site: {
            id: target.id,
            name: 'Pointe de la Revellata',
            locality: 'Calvi',
            region: 'Côte Bleue',
          },
        }),
      ]);
    });

    it('keeps the depths of the target when completing them would break min ≤ max', async () => {
      const diver = await fixtures.diver();
      const target = await fixtures.site(diver.id, { depthMinM: 40, depthMaxM: null });
      const source = await fixtures.site(diver.id, { depthMinM: 5, depthMaxM: 20 });

      const merged = await sites.merge(asDiverId(diver.id), source.id, target.id);

      expect(merged).toMatchObject({ depthMinM: 40, depthMaxM: null });
    });

    it('accepts ids in any case and locks the sites in id order', async () => {
      const { diver, target, source } = await mergeScenario();

      await expect(
        sites.merge(asDiverId(diver.id), source.id.toUpperCase(), target.id.toUpperCase()),
      ).resolves.toMatchObject({ id: target.id });
    });

    it('runs two crossed merges one after the other, without deadlock', async () => {
      const diver = await fixtures.diver();
      const first = await fixtures.site(diver.id);
      const second = await fixtures.site(diver.id);

      const results = await Promise.allSettled([
        sites.merge(asDiverId(diver.id), first.id, second.id),
        sites.merge(asDiverId(diver.id), second.id, first.id),
      ]);

      // The second one waits, then finds its target deleted (merged) by the first one.
      expect(results.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
      const rejected = results.find((result) => result.status === 'rejected');
      expect(rejected?.reason).toBeInstanceOf(InvalidReferenceError);
      expect(await sites.list(asDiverId(diver.id))).toEqual({ sites: [expect.anything()] });
    });

    it('refuses a source or a target that is not a live site of the diver, without writing', async () => {
      const { diver, target, source, live } = await mergeScenario();
      const other = await fixtures.diver();
      const othersSite = await fixtures.site(other.id);
      const deleted = await fixtures.site(diver.id, { deletedAt: new Date() });

      for (const sourceId of [randomUUID(), deleted.id, othersSite.id]) {
        await expect(sites.merge(asDiverId(diver.id), sourceId, target.id)).rejects.toThrow(
          NotFoundException,
        );
      }
      await expect(sites.merge(asDiverId(diver.id), source.id, source.id)).rejects.toThrow(
        MergeIntoSelfError,
      );
      await expect(sites.merge(asDiverId(diver.id), deleted.id, deleted.id)).rejects.toThrow(
        NotFoundException,
      );
      for (const targetId of [randomUUID(), deleted.id, othersSite.id]) {
        await expect(sites.merge(asDiverId(diver.id), source.id, targetId)).rejects.toThrow(
          InvalidReferenceError,
        );
      }
      // Another diver can neither merge these sites nor merge into them.
      await expect(sites.merge(asDiverId(other.id), source.id, target.id)).rejects.toThrow(
        NotFoundException,
      );
      await expect(sites.merge(asDiverId(other.id), othersSite.id, target.id)).rejects.toThrow(
        InvalidReferenceError,
      );

      expect(await siteRow(source.id)).toMatchObject({ deletedAt: null, mergedIntoId: null });
      expect(await dataSource.manager.findOneByOrFail(DiveEvent, { id: live.id })).toMatchObject({
        siteId: source.id,
      });
      expect(await siteRow(othersSite.id)).toMatchObject({ deletedAt: null });
    });

    it('rolls everything back when a step fails', async () => {
      const { diver, target, source, live, earlier } = await mergeScenario();
      const before = await siteRow(target.id);
      // Makes the last step (tombstone of the source) fail, after the others have run.
      await dataSource.query(`
        CREATE FUNCTION test_fail_merge() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'merge failure'; END $$`);
      await dataSource.query(`
        CREATE TRIGGER trg_test_fail_merge BEFORE UPDATE ON dive_sites FOR EACH ROW
        WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
        EXECUTE FUNCTION test_fail_merge()`);
      try {
        await expect(sites.merge(asDiverId(diver.id), source.id, target.id)).rejects.toThrow(
          'merge failure',
        );
      } finally {
        await dataSource.query('DROP TRIGGER trg_test_fail_merge ON dive_sites');
        await dataSource.query('DROP FUNCTION test_fail_merge()');
      }

      expect(await dataSource.manager.findOneByOrFail(DiveEvent, { id: live.id })).toMatchObject({
        siteId: source.id,
      });
      expect(await siteRow(target.id)).toEqual(before);
      expect(await siteRow(earlier.id)).toMatchObject({ mergedIntoId: source.id });
      expect(await siteRow(source.id)).toMatchObject({ deletedAt: null, mergedIntoId: null });
    });
  });

  describe('remove (D-31)', () => {
    it('refuses to delete a site with a live dive (site-in-use), keeps it', async () => {
      const diver = await fixtures.diver();
      const site = await fixtures.site(diver.id);
      await diveOn(diver.id, site.id);

      await expect(sites.remove(asDiverId(diver.id), site.id)).rejects.toThrow(SiteInUseError);
      expect(await siteRow(site.id)).toMatchObject({ deletedAt: null });
    });

    it('deletes a site whose dives are all deleted, without merge target', async () => {
      const diver = await fixtures.diver();
      const site = await fixtures.site(diver.id);
      await diveOn(diver.id, site.id, new Date());

      await expect(sites.remove(asDiverId(diver.id), site.id)).resolves.toBe(true);
      expect(await siteRow(site.id)).toMatchObject({
        deletedAt: expect.any(Date) as unknown,
        mergedIntoId: null,
      });
    });

    it("deletes nothing for an absent, deleted or another diver's site", async () => {
      const diver = await fixtures.diver();
      const other = await fixtures.diver();
      const deleted = await fixtures.site(diver.id, { deletedAt: new Date() });
      const othersSite = await fixtures.site(other.id);

      for (const id of [randomUUID(), deleted.id, othersSite.id]) {
        await expect(sites.remove(asDiverId(diver.id), id)).resolves.toBe(false);
      }
      expect(await siteRow(othersSite.id)).toMatchObject({ deletedAt: null });
    });
  });

  describe('synchronisation of a merged site (RG-36)', () => {
    it('rejects any write on a merged site and returns the server state', async () => {
      const diver = await fixtures.diver();
      const target = await fixtures.site(diver.id);
      const merged = await fixtures.site(diver.id, {
        deletedAt: new Date(),
        mergedIntoId: target.id,
      });

      const restore = await sites.upsert(
        diver.id,
        siteWrite({ id: merged.id, baseUpdatedAt: new Date(Date.now() + 60_000) }),
        recentPull(),
      );

      expect(restore).toMatchObject({
        status: 'rejected',
        current: { id: merged.id, mergedIntoId: target.id },
      });
      expect(await siteRow(merged.id)).toMatchObject({
        deletedAt: expect.any(Date) as unknown,
        name: 'La Vesse',
      });
    });

    it('keeps the origin of an existing site, sets it on creation (RG-34)', async () => {
      const diver = await fixtures.diver();
      const write = siteWrite({ createdVia: 'quick' });

      await sites.upsert(diver.id, write, recentPull());
      await sites.upsert(diver.id, { ...write, createdVia: 'full' }, recentPull());

      expect(await siteRow(write.id)).toMatchObject({ createdVia: 'quick' });
    });

    it('pulls the merge target of a merged site', async () => {
      const diver = await fixtures.diver();
      const target = await fixtures.site(diver.id);
      const source = await fixtures.site(diver.id);
      await sites.merge(asDiverId(diver.id), source.id, target.id);

      const page = await sites.pull(diver.id, null);

      expect(page.items.find((item) => item.id === source.id)).toMatchObject({
        mergedIntoId: target.id,
      });
    });
  });

  describe('dives written on a merged site (RG-36)', () => {
    async function mergedSites() {
      const diver = await fixtures.diver();
      const target = await fixtures.site(diver.id, { name: 'Cible' });
      const source = await fixtures.site(diver.id, { name: 'Source' });
      await sites.merge(asDiverId(diver.id), source.id, target.id);
      return { diver, target, source };
    }

    it('redirects POST /dives to the target, never recreating nor restoring the source', async () => {
      const { diver, target, source } = await mergedSites();
      const request = diveWriteRequest({ site: { id: source.id, name: 'Source', isNew: true } });

      await diveWrites.create(asDiverId(diver.id), request);
      const replay = await diveWrites.create(asDiverId(diver.id), request);

      expect(replay.outcome).toBe('replayed');
      expect(
        await dataSource.manager.findOneByOrFail(DiveEvent, { id: request.event.id }),
      ).toMatchObject({ siteId: target.id });
      expect(await siteRow(source.id)).toMatchObject({
        deletedAt: expect.any(Date) as unknown,
        mergedIntoId: target.id,
      });
      expect(await diveLog.findOne(asDiverId(diver.id), request.event.id)).toMatchObject({
        site: { id: target.id, name: 'Cible' },
      });
    });

    it('redirects PUT /dives to the target', async () => {
      const { diver, target, source } = await mergedSites();
      const other = await fixtures.site(diver.id);
      const request = diveWriteRequest({ site: { id: other.id } });
      await diveWrites.create(asDiverId(diver.id), request);

      await diveWrites.replace(asDiverId(diver.id), request.event.id, {
        ...request,
        event: { ...request.event, siteId: source.id },
        site: { id: source.id, name: 'Source', isNew: false },
      });

      expect(
        await dataSource.manager.findOneByOrFail(DiveEvent, { id: request.event.id }),
      ).toMatchObject({ siteId: target.id });
    });

    it('redirects a synchronised dive to the target, which a deleted target restores (D-12 b)', async () => {
      const { diver, target, source } = await mergedSites();
      await dataSource.manager.update(DiveSite, { id: target.id }, { deletedAt: new Date() });
      const write = diveWrite(source.id);

      const result = await dives.upsertDive(diver.id, write, recentPull());

      expect(result).toMatchObject({
        status: 'applied',
        current: { event: { siteId: target.id } },
      });
      expect(await siteRow(target.id)).toMatchObject({ deletedAt: null });
      expect(await siteRow(source.id)).toMatchObject({ mergedIntoId: target.id });
    });

    it("never follows another diver's merge", async () => {
      const { source } = await mergedSites();
      const other = await fixtures.diver();

      await expect(dives.upsertDive(other.id, diveWrite(source.id), recentPull())).rejects.toThrow(
        InvalidReferenceError,
      );
    });
  });
});
