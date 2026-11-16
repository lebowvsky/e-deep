import { NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { DiveSite } from '../../src/modules/dive-sites/dive-site.entity';
import { DiveSitesService } from '../../src/modules/dive-sites/dive-sites.service';
import { DiveEvent } from '../../src/modules/dives/dive-event.entity';
import { DiveLogService } from '../../src/modules/dives/dive-log.service';
import { DiveParticipation } from '../../src/modules/dives/dive-participation.entity';
import { Fixtures, recentPull, siteWrite, SYNC_SETTINGS_90_DAYS } from './support/fixtures';
import { selectRows, violating } from './support/sql';
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

  describe('findOne: detail fields (AddDiveDetailFields)', () => {
    it('returns the conditions, the detail, the levels, the observations and the timestamps', async () => {
      const diver = await fixtures.diver({ certificationLevelId: await fixtures.levelId('N2') });
      const retired = await fixtures.addLevel({
        agency: 'CMAS',
        code: '2*',
        label: 'Plongeur 2 étoiles',
        isActive: false,
      });
      const lucas = await fixtures.buddy(diver.id, {
        firstName: 'Lucas',
        certificationLevelId: await fixtures.levelId('N3'),
      });
      const thao = await fixtures.buddy(diver.id, {
        firstName: 'Thao',
        certificationLevelId: null,
      });
      const sofia = await fixtures.buddy(diver.id, {
        firstName: 'Sofia',
        certificationLevelId: retired.id,
      });
      const site = await fixtures.site(diver.id, { area: 'Méditerranée' });
      const event = await fixtures.event(diver.id, site.id, {
        entryType: 'BOAT',
        timeOfDay: 'DAY',
        weather: 'SUNNY',
        airTemperatureC: 19,
        seaState: 'CALM',
        currentStrength: 'WEAK',
        diveCenter: 'Calvi Plongée',
      });
      const participation = await fixtures.participation(event.id, diver.id, {
        certificationLevelId: diver.certificationLevelId,
        maxDepthM: 42,
        durationMin: 38,
        gasMix: 'OTHER',
        o2Percent: 28,
        surfaceWaterTemperatureC: 16,
        safetyStopDurationMin: 3,
        safetyStopDepthM: 5,
        isRepetitive: false,
        tankVolumeL: 12,
        tankMaterial: 'STEEL',
        startPressureBar: 200,
        endPressureBar: 60,
        suitType: 'SEMI_DRY',
        suitThicknessMm: 7,
        weightKg: 6.5,
      });
      for (const buddy of [lucas, thao, sofia]) {
        await fixtures.diveBuddy(diver.id, participation.id, buddy.id);
      }
      // Inserted out of order: served by position.
      await fixtures.observation(participation.id, 1, 'Barracudas');
      await fixtures.observation(participation.id, 0, 'Mérou brun', 2);

      const detail = await diveLog.findOne(diver.id, event.id);

      expect(detail).toMatchObject({
        site: { area: 'Méditerranée' },
        diverLevel: { agency: 'FFESSM', code: 'N2', label: 'Niveau 2' },
        entryType: 'BOAT',
        timeOfDay: 'DAY',
        weather: 'SUNNY',
        airTemperatureC: 19,
        seaState: 'CALM',
        currentStrength: 'WEAK',
        diveCenter: 'Calvi Plongée',
        surfaceTemperatureC: 16,
        safetyStopDurationMin: 3,
        safetyStopDepthM: 5,
        isRepetitive: false,
        o2Percent: 28,
        tankVolumeL: 12,
        tankMaterial: 'STEEL',
        startPressureBar: 200,
        endPressureBar: 60,
        suitType: 'SEMI_DRY',
        suitThicknessMm: 7,
        weightKg: 6.5,
        observations: [
          { label: 'Mérou brun', count: 2 },
          { label: 'Barracudas', count: null },
        ],
      });
      expect(new Map(detail.buddies.map((buddy) => [buddy.firstName, buddy.level]))).toEqual(
        new Map([
          ['Lucas', { agency: 'FFESSM', code: 'N3', label: 'Niveau 3' }],
          ['Thao', null],
          // A deactivated level is still served (D-21).
          ['Sofia', { agency: 'CMAS', code: '2*', label: 'Plongeur 2 étoiles' }],
        ]),
      );
      expect(detail.createdAt).toBe(participation.createdAt.toISOString());
    });

    it('never reads the level of the account linked to a buddy (RG-10)', async () => {
      const diver = await fixtures.diver();
      const linked = await fixtures.diver({ certificationLevelId: await fixtures.levelId('N4') });
      const buddy = await fixtures.buddy(diver.id, { linkedDiverId: linked.id });
      const { event, participation } = await fixtures.dive(diver.id);
      await fixtures.diveBuddy(diver.id, participation.id, buddy.id);

      const detail = await diveLog.findOne(diver.id, event.id);

      expect(detail.buddies).toStrictEqual([
        { id: buddy.id, firstName: buddy.firstName, lastName: buddy.lastName, level: null },
      ]);
    });

    it('serves null everywhere for an older dive without detail', async () => {
      const diver = await fixtures.diver();
      const site = await fixtures.site(diver.id);
      const event = await dive(diver.id, site.id, '2026-06-01T08:00:00.000Z');

      const detail = await diveLog.findOne(diver.id, event.id);

      expect(detail).toMatchObject({
        site: { area: null },
        diverLevel: { agency: 'FFESSM', code: 'N1', label: 'Niveau 1' },
        entryType: null,
        timeOfDay: null,
        weather: null,
        airTemperatureC: null,
        seaState: null,
        currentStrength: null,
        diveCenter: null,
        surfaceTemperatureC: null,
        safetyStopDurationMin: null,
        safetyStopDepthM: null,
        isRepetitive: null,
        o2Percent: null,
        tankVolumeL: null,
        tankMaterial: null,
        startPressureBar: null,
        endPressureBar: null,
        suitType: null,
        suitThicknessMm: null,
        weightKg: null,
        observations: [],
      });
    });

    it('serves updatedAt as the latest change of the event or the participation', async () => {
      const diver = await fixtures.diver();
      const { event, participation } = await fixtures.dive(diver.id);
      const latestOf = async (): Promise<string> => {
        const [row] = await selectRows<{ latest: Date }>(
          dataSource,
          `SELECT GREATEST(e.updated_at, p.updated_at) AS latest
             FROM dive_events e JOIN dive_participations p ON p.dive_event_id = e.id
            WHERE e.id = $1`,
          [event.id],
        );
        return row?.latest.toISOString() ?? '';
      };

      await dataSource.manager.update(DiveEvent, { id: event.id }, { weather: 'RAIN' });
      const afterEvent = await diveLog.findOne(diver.id, event.id);
      const event2 = await dataSource.manager.findOneByOrFail(DiveEvent, { id: event.id });
      expect(afterEvent.updatedAt).toBe(event2.updatedAt.toISOString());
      expect(afterEvent.updatedAt).toBe(await latestOf());

      await dataSource.manager.update(DiveParticipation, { id: participation.id }, { weightKg: 5 });
      const afterParticipation = await diveLog.findOne(diver.id, event.id);
      const participation2 = await dataSource.manager.findOneByOrFail(DiveParticipation, {
        id: participation.id,
      });
      expect(afterParticipation.updatedAt).toBe(participation2.updatedAt.toISOString());
      expect(afterParticipation.updatedAt > afterEvent.updatedAt).toBe(true);
    });

    it('keeps the list free of the detail fields (D-25)', async () => {
      const diver = await fixtures.diver();
      const { event, participation } = await fixtures.dive(diver.id);
      await fixtures.observation(participation.id, 0, 'Murène');
      await dataSource.manager.update(DiveEvent, { id: event.id }, { entryType: 'SHORE' });

      const { dives } = await diveLog.findAll(diver.id);

      expect(Object.keys(dives[0] ?? {}).sort()).toStrictEqual(
        [
          'buddies',
          'date',
          'depthMaxM',
          'durationMin',
          'gasMix',
          'id',
          'notes',
          'number',
          'site',
          'temperatureC',
          'utcOffsetMinutes',
        ].sort(),
      );
      expect(Object.keys(dives[0]?.site ?? {}).sort()).toStrictEqual(
        ['id', 'locality', 'name', 'region'].sort(),
      );
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
