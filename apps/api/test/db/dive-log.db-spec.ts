import { NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DiveSite } from '../../src/modules/dive-sites/dive-site.entity';
import { DiveSitesService } from '../../src/modules/dive-sites/dive-sites.service';
import { DiveLogService } from '../../src/modules/dives/dive-log.service';
import { Fixtures, recentPull, siteWrite, SYNC_SETTINGS_90_DAYS } from './support/fixtures';
import { violating } from './support/sql';
import { createTestDataSource, resetDatabase } from './support/test-database';

describe('DiveLogService', () => {
  let dataSource: DataSource;
  let fixtures: Fixtures;
  let diveLog: DiveLogService;

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    fixtures = new Fixtures(dataSource);
    diveLog = new DiveLogService(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  /** One dive of `diverId` at `siteId`; `deleted` tombstones the event or the participation. */
  async function dive(
    diverId: string,
    siteId: string,
    startedAt: string,
    options: { buddyIds?: readonly string[]; deleted?: 'event' | 'participation' } = {},
  ) {
    const event = await fixtures.event(diverId, siteId, {
      startedAt: new Date(startedAt),
      utcOffsetMinutes: 60,
      ...(options.deleted === 'event' ? { deletedAt: new Date() } : {}),
    });
    const participation = await fixtures.participation(event.id, diverId, {
      maxDepthM: 24.5,
      waterTemperatureC: null,
      ...(options.deleted === 'participation' ? { deletedAt: new Date() } : {}),
    });
    for (const buddyId of options.buddyIds ?? []) {
      await fixtures.diveBuddy(diverId, participation.id, buddyId);
    }
    return event;
  }

  describe('findAll', () => {
    it("returns the owner's live dives only, numbered chronologically, latest first, with teams", async () => {
      const diver = await fixtures.diver();
      const other = await fixtures.diver();
      const lucas = await fixtures.buddy(diver.id, { firstName: 'Lucas' });
      const gone = await fixtures.buddy(diver.id, {
        firstName: 'Gone',
        deletedAt: new Date(),
      });
      const site = await fixtures.site(diver.id, {
        name: 'Revellata',
        locality: 'Calvi',
        region: 'Corse',
      });

      const first = await dive(diver.id, site.id, '2026-06-01T08:00:00.000Z', {
        buddyIds: [lucas.id],
      });
      // Tombstoned dives sit between the live ones: they must not consume a number.
      await dive(diver.id, site.id, '2026-06-15T08:00:00.000Z', { deleted: 'event' });
      await dive(diver.id, site.id, '2026-06-20T08:00:00.000Z', { deleted: 'participation' });
      const second = await dive(diver.id, site.id, '2026-07-01T08:00:00.000Z');
      const third = await dive(diver.id, site.id, '2026-08-01T08:00:00.000Z', {
        buddyIds: [gone.id],
      });
      await fixtures.dive(other.id);

      const { dives } = await diveLog.findAll(diver.id);

      expect(dives.map((entry) => [entry.id, entry.number])).toStrictEqual([
        [third.id, 3],
        [second.id, 2],
        [first.id, 1],
      ]);
      expect(dives[2]).toStrictEqual({
        id: first.id,
        number: 1,
        date: '2026-06-01T09:00:00+01:00',
        utcOffsetMinutes: 60,
        site: { id: site.id, name: 'Revellata', locality: 'Calvi', region: 'Corse' },
        depthMaxM: 24.5,
        durationMin: 45,
        temperatureC: null,
        gasMix: 'AIR',
        notes: null,
        buddies: [{ id: lucas.id, firstName: 'Lucas', lastName: lucas.lastName }],
      });
      // A dive without buddy, and one whose only buddy is tombstoned.
      expect(dives[1]?.buddies).toStrictEqual([]);
      expect(dives[0]?.buddies).toStrictEqual([]);
    });

    it('returns an empty log for a diver without live dive', async () => {
      const diver = await fixtures.diver();
      const site = await fixtures.site(diver.id);
      await dive(diver.id, site.id, '2026-06-01T08:00:00.000Z', { deleted: 'event' });

      await expect(diveLog.findAll(diver.id)).resolves.toStrictEqual({ dives: [] });
    });
  });

  describe('findOne', () => {
    it('returns a live dive of the diver with its number and detail fields', async () => {
      const diver = await fixtures.diver();
      const site = await fixtures.site(diver.id, { latitude: 42.58, longitude: 8.72 });
      await dive(diver.id, site.id, '2026-06-01T08:00:00.000Z');
      const latest = await dive(diver.id, site.id, '2026-07-01T08:00:00.000Z');

      const detail = await diveLog.findOne(diver.id, latest.id);

      expect(detail).toMatchObject({
        id: latest.id,
        number: 2,
        site: { id: site.id, locality: null, latitude: 42.58, longitude: 8.72 },
        visibilityM: 15,
        hadDecompression: false,
        stopsOk: true,
      });
    });

    it("refuses another diver's dive, a deleted dive and an unknown id alike", async () => {
      const diver = await fixtures.diver();
      const other = await fixtures.diver();
      const { event: foreign } = await fixtures.dive(other.id);
      const site = await fixtures.site(diver.id);
      const deleted = await dive(diver.id, site.id, '2026-06-01T08:00:00.000Z', {
        deleted: 'participation',
      });

      for (const id of [foreign.id, deleted.id, '01900000-0000-7000-8000-0000000000ff']) {
        await expect(diveLog.findOne(diver.id, id)).rejects.toThrow(NotFoundException);
      }
      await expect(diveLog.findOne(other.id, foreign.id)).resolves.toMatchObject({
        id: foreign.id,
      });
    });
  });

  describe('site locality', () => {
    it('round-trips through DiveSitesService, null when omitted', async () => {
      const sites = new DiveSitesService(dataSource, SYNC_SETTINGS_90_DAYS);
      const diver = await fixtures.diver();

      const withLocality = await sites.upsert(
        diver.id,
        siteWrite({ locality: 'Porquerolles' }),
        recentPull(),
      );
      const without = await sites.upsert(diver.id, siteWrite(), recentPull());

      expect(withLocality.current.locality).toBe('Porquerolles');
      expect(without.current.locality).toBeNull();
      await dive(diver.id, withLocality.current.id, '2026-06-01T08:00:00.000Z');
      const { dives } = await diveLog.findAll(diver.id);
      expect(dives[0]?.site.locality).toBe('Porquerolles');
    });

    it('rejects a blank locality', async () => {
      const diver = await fixtures.diver();
      const site = await fixtures.site(diver.id);

      await expect(
        dataSource.manager.update(DiveSite, { id: site.id }, { locality: '   ' }),
      ).rejects.toEqual(violating('ck_dive_sites__locality'));
    });
  });
});
