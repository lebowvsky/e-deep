import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { Buddy } from '../../src/modules/buddies/buddy.entity';
import { CertificationLevel } from '../../src/modules/certification-levels/certification-level.entity';
import { DiveSite } from '../../src/modules/dive-sites/dive-site.entity';
import { Diver } from '../../src/modules/divers/diver.entity';
import { DiveBuddy } from '../../src/modules/dives/dive-buddy.entity';
import { DiveEvent } from '../../src/modules/dives/dive-event.entity';
import { DiveObservation } from '../../src/modules/dives/dive-observation.entity';
import { DiveParticipation } from '../../src/modules/dives/dive-participation.entity';
import { Fixtures } from './support/fixtures';
import { selectRows, updatedAtOf, violating } from './support/sql';
import { createTestDataSource, resetDatabase } from './support/test-database';

describe('dive log schema constraints', () => {
  let dataSource: DataSource;
  let fixtures: Fixtures;

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    fixtures = new Fixtures(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  async function newEvent() {
    const diver = await fixtures.diver();
    const site = await fixtures.site(diver.id);
    const event = await fixtures.event(diver.id, site.id);
    return { diver, site, event };
  }

  describe('CHECK constraints', () => {
    it.each([
      ['maxDepthM', 0, 'ck_dive_participations__max_depth_m'],
      ['maxDepthM', 350.1, 'ck_dive_participations__max_depth_m'],
      ['durationMin', 0, 'ck_dive_participations__duration_min'],
      ['durationMin', 1441, 'ck_dive_participations__duration_min'],
      ['waterTemperatureC', -5.1, 'ck_dive_participations__water_temperature_c'],
      ['waterTemperatureC', 45.1, 'ck_dive_participations__water_temperature_c'],
      ['visibilityM', -1, 'ck_dive_participations__visibility_m'],
      ['visibilityM', 101, 'ck_dive_participations__visibility_m'],
      ['gasMix', 'NITROX40', 'ck_dive_participations__gas_mix'],
    ] as const)('refuses a participation with %s = %s', async (property, value, constraint) => {
      const { diver, event } = await newEvent();
      await expect(
        fixtures.participation(event.id, diver.id, { [property]: value }),
      ).rejects.toEqual(violating(constraint));
    });

    it('accepts the participation bounds', async () => {
      const { diver, event } = await newEvent();
      const participation = await fixtures.participation(event.id, diver.id, {
        maxDepthM: 350,
        durationMin: 1440,
        waterTemperatureC: -5,
        visibilityM: 0,
        gasMix: 'OTHER',
      });
      expect(participation).toMatchObject({ maxDepthM: 350, waterTemperatureC: -5 });
    });

    it.each([
      ['latitude', 90.5, 'ck_dive_sites__latitude'],
      ['latitude', -90.5, 'ck_dive_sites__latitude'],
      ['longitude', 180.5, 'ck_dive_sites__longitude'],
      ['longitude', -180.5, 'ck_dive_sites__longitude'],
      ['name', '   ', 'ck_dive_sites__name'],
    ] as const)('refuses a site with %s = %s', async (property, value, constraint) => {
      const diver = await fixtures.diver();
      await expect(fixtures.site(diver.id, { [property]: value })).rejects.toEqual(
        violating(constraint),
      );
    });

    it('accepts a site without region nor position (D-23)', async () => {
      const diver = await fixtures.diver();
      await expect(
        fixtures.site(diver.id, { region: null, latitude: null, longitude: null }),
      ).resolves.toMatchObject({ region: null, latitude: null, longitude: null });
    });

    it.each([[{ latitude: null }], [{ longitude: null }]])(
      'refuses half a position %j',
      async (values) => {
        const diver = await fixtures.diver();
        await expect(fixtures.site(diver.id, values)).rejects.toEqual(
          violating('ck_dive_sites__position'),
        );
      },
    );

    it.each(['  ', 'r'.repeat(121)])('still refuses a region %j', async (region) => {
      const diver = await fixtures.diver();
      await expect(fixtures.site(diver.id, { region })).rejects.toEqual(
        violating('ck_dive_sites__region'),
      );
    });

    it.each([-721, 841])('refuses utc_offset_minutes = %s', async (utcOffsetMinutes) => {
      const diver = await fixtures.diver();
      const site = await fixtures.site(diver.id);
      await expect(fixtures.event(diver.id, site.id, { utcOffsetMinutes })).rejects.toEqual(
        violating('ck_dive_events__utc_offset_minutes'),
      );
    });

    it('accepts utc_offset_minutes bounds', async () => {
      const diver = await fixtures.diver();
      const site = await fixtures.site(diver.id);
      await expect(
        fixtures.event(diver.id, site.id, { utcOffsetMinutes: -720 }),
      ).resolves.toBeDefined();
      await expect(
        fixtures.event(diver.id, site.id, { utcOffsetMinutes: 840 }),
      ).resolves.toBeDefined();
    });

    it('refuses a non-positive rank', async () => {
      await expect(fixtures.addLevel({ rank: 0 })).rejects.toEqual(
        violating('ck_certification_levels__rank'),
      );
    });

    it('refuses a buddy linked to its own owner', async () => {
      const diver = await fixtures.diver();
      await expect(fixtures.buddy(diver.id, { linkedDiverId: diver.id })).rejects.toEqual(
        violating('ck_buddies__not_self'),
      );
    });
  });

  describe('detail fields (AddDiveDetailFields)', () => {
    it.each([
      ['entryType', 'BOAT_DIVE', 'ck_dive_events__entry_type'],
      ['timeOfDay', 'DUSK', 'ck_dive_events__time_of_day'],
      ['weather', 'SNOW', 'ck_dive_events__weather'],
      ['airTemperatureC', -40.1, 'ck_dive_events__air_temperature_c'],
      ['airTemperatureC', 60.1, 'ck_dive_events__air_temperature_c'],
      ['seaState', 'STORM', 'ck_dive_events__sea_state'],
      ['currentStrength', 'EXTREME', 'ck_dive_events__current_strength'],
      ['diveCenter', '  ', 'ck_dive_events__dive_center'],
      ['diveCenter', 'x'.repeat(121), 'ck_dive_events__dive_center'],
    ] as const)('refuses an event with %s = %s', async (property, value, constraint) => {
      const diver = await fixtures.diver();
      const site = await fixtures.site(diver.id);
      await expect(fixtures.event(diver.id, site.id, { [property]: value })).rejects.toEqual(
        violating(constraint),
      );
    });

    it('accepts the event detail bounds, and NULL everywhere', async () => {
      const diver = await fixtures.diver();
      const site = await fixtures.site(diver.id);
      const empty = await fixtures.event(diver.id, site.id);
      const full = await fixtures.event(diver.id, site.id, {
        entryType: 'SHORE',
        timeOfDay: 'NIGHT',
        weather: 'RAIN',
        airTemperatureC: -40,
        seaState: 'ROUGH',
        currentStrength: 'STRONG',
        diveCenter: 'x'.repeat(120),
      });
      expect(empty).toMatchObject({ entryType: null, airTemperatureC: null, diveCenter: null });
      expect(full).toMatchObject({ airTemperatureC: -40, seaState: 'ROUGH' });
      await expect(
        fixtures.event(diver.id, site.id, { airTemperatureC: 60 }),
      ).resolves.toBeDefined();
    });

    it.each([
      ['surfaceWaterTemperatureC', -5.1, 'ck_dive_participations__surface_water_temperature_c'],
      ['surfaceWaterTemperatureC', 45.1, 'ck_dive_participations__surface_water_temperature_c'],
      ['tankVolumeL', 0, 'ck_dive_participations__tank_volume_l'],
      ['tankVolumeL', 30.1, 'ck_dive_participations__tank_volume_l'],
      ['tankMaterial', 'CARBON', 'ck_dive_participations__tank_material'],
      ['startPressureBar', 0, 'ck_dive_participations__start_pressure_bar'],
      ['startPressureBar', 351, 'ck_dive_participations__start_pressure_bar'],
      ['endPressureBar', -1, 'ck_dive_participations__end_pressure_bar'],
      ['endPressureBar', 351, 'ck_dive_participations__end_pressure_bar'],
      ['suitType', 'SHORTY', 'ck_dive_participations__suit_type'],
      ['suitThicknessMm', 0, 'ck_dive_participations__suit_thickness_mm'],
      ['suitThicknessMm', 15.1, 'ck_dive_participations__suit_thickness_mm'],
      ['weightKg', -0.5, 'ck_dive_participations__weight_kg'],
      ['weightKg', 40.5, 'ck_dive_participations__weight_kg'],
    ] as const)('refuses a participation with %s = %s', async (property, value, constraint) => {
      const { diver, event } = await newEvent();
      await expect(
        fixtures.participation(event.id, diver.id, { [property]: value }),
      ).rejects.toEqual(violating(constraint));
    });

    it('accepts the participation detail bounds, and NULL everywhere', async () => {
      const { diver, event } = await newEvent();
      const other = await newEvent();
      const empty = await fixtures.participation(other.event.id, other.diver.id);
      const full = await fixtures.participation(event.id, diver.id, {
        maxDepthM: 20,
        durationMin: 61,
        surfaceWaterTemperatureC: 45,
        safetyStopDurationMin: 60,
        safetyStopDepthM: 20,
        isRepetitive: true,
        tankVolumeL: 30,
        tankMaterial: 'ALUMINIUM',
        startPressureBar: 350,
        endPressureBar: 0,
        suitType: 'SEMI_DRY',
        suitThicknessMm: 15,
        weightKg: 40,
      });
      expect(empty).toMatchObject({
        surfaceWaterTemperatureC: null,
        safetyStopDurationMin: null,
        isRepetitive: null,
        weightKg: null,
      });
      expect(full).toMatchObject({ safetyStopDepthM: 20, weightKg: 40, endPressureBar: 0 });
    });

    it('accepts o2_percent with the OTHER mix only (RG-23)', async () => {
      const { diver, event } = await newEvent();
      const other = await newEvent();
      await expect(
        fixtures.participation(event.id, diver.id, { gasMix: 'AIR', o2Percent: 21 }),
      ).rejects.toEqual(violating('ck_dive_participations__o2_percent'));
      await expect(
        fixtures.participation(event.id, diver.id, { gasMix: 'NITROX32', o2Percent: 32 }),
      ).rejects.toEqual(violating('ck_dive_participations__o2_percent'));
      await expect(
        fixtures.participation(event.id, diver.id, { gasMix: 'OTHER', o2Percent: 100.1 }),
      ).rejects.toEqual(violating('ck_dive_participations__o2_percent'));
      await expect(
        fixtures.participation(other.event.id, other.diver.id, {
          gasMix: 'OTHER',
          o2Percent: 28.5,
        }),
      ).resolves.toMatchObject({ o2Percent: 28.5 });
    });

    it('refuses an end pressure above the start pressure, accepts an end pressure alone (RG-24)', async () => {
      const { diver, event } = await newEvent();
      const other = await newEvent();
      await expect(
        fixtures.participation(event.id, diver.id, { startPressureBar: 200, endPressureBar: 201 }),
      ).rejects.toEqual(violating('ck_dive_participations__end_pressure_bar'));
      await expect(
        fixtures.participation(other.event.id, other.diver.id, { endPressureBar: 50 }),
      ).resolves.toMatchObject({ startPressureBar: null, endPressureBar: 50 });
    });

    it('refuses an incomplete safety stop, too deep or too long (RG-25)', async () => {
      const { diver, event } = await newEvent();
      await expect(
        fixtures.participation(event.id, diver.id, { safetyStopDurationMin: 3 }),
      ).rejects.toEqual(violating('ck_dive_participations__safety_stop'));
      await expect(
        fixtures.participation(event.id, diver.id, { safetyStopDepthM: 5 }),
      ).rejects.toEqual(violating('ck_dive_participations__safety_stop'));
      await expect(
        fixtures.participation(event.id, diver.id, {
          maxDepthM: 4,
          safetyStopDurationMin: 3,
          safetyStopDepthM: 5,
        }),
      ).rejects.toEqual(violating('ck_dive_participations__safety_stop_depth_m'));
      await expect(
        fixtures.participation(event.id, diver.id, {
          durationMin: 30,
          safetyStopDurationMin: 30,
          safetyStopDepthM: 5,
        }),
      ).rejects.toEqual(violating('ck_dive_participations__safety_stop_duration_min'));
      await expect(
        fixtures.participation(event.id, diver.id, {
          safetyStopDurationMin: 0,
          safetyStopDepthM: 5,
        }),
      ).rejects.toEqual(violating('ck_dive_participations__safety_stop_duration_min'));
      await expect(
        fixtures.participation(event.id, diver.id, {
          safetyStopDurationMin: 3,
          safetyStopDepthM: 0,
        }),
      ).rejects.toEqual(violating('ck_dive_participations__safety_stop_depth_m'));
    });

    it.each([
      ['  ', 'ck_dive_sites__area'],
      ['x'.repeat(121), 'ck_dive_sites__area'],
    ])('refuses a site area %j', async (area, constraint) => {
      const diver = await fixtures.diver();
      await expect(fixtures.site(diver.id, { area })).rejects.toEqual(violating(constraint));
    });

    it('accepts a site area or none', async () => {
      const diver = await fixtures.diver();
      await expect(fixtures.site(diver.id, { area: 'Méditerranée' })).resolves.toMatchObject({
        area: 'Méditerranée',
      });
      await expect(fixtures.site(diver.id)).resolves.toMatchObject({ area: null });
    });
  });

  describe('dive_observations', () => {
    it('refuses the same label twice on a participation, accepts it on another one', async () => {
      const diver = await fixtures.diver();
      const first = await fixtures.dive(diver.id);
      const second = await fixtures.dive(diver.id);
      await fixtures.observation(first.participation.id, 0, 'Murène');

      await expect(fixtures.observation(first.participation.id, 1, 'Murène')).rejects.toEqual(
        violating('uq_dive_observations__participation_id_label'),
      );
      await expect(
        fixtures.observation(second.participation.id, 0, 'Murène'),
      ).resolves.toBeUndefined();
    });

    it.each([
      [50, 'Corb', null, 'ck_dive_observations__position'],
      [-1, 'Corb', null, 'ck_dive_observations__position'],
      [0, '   ', null, 'ck_dive_observations__label'],
      [0, 'x'.repeat(81), null, 'ck_dive_observations__label'],
      [0, 'Corb', 0, 'ck_dive_observations__count'],
      [0, 'Corb', 10000, 'ck_dive_observations__count'],
    ] as const)(
      'refuses position %s, label %j, count %s',
      async (position, label, count, constraint) => {
        const diver = await fixtures.diver();
        const { participation } = await fixtures.dive(diver.id);
        await expect(
          fixtures.observation(participation.id, position, label, count),
        ).rejects.toEqual(violating(constraint));
      },
    );

    it('accepts positions 0 to 49, a NULL count and the count bounds', async () => {
      const diver = await fixtures.diver();
      const { participation } = await fixtures.dive(diver.id);
      await fixtures.observation(participation.id, 0, 'x'.repeat(80), null);
      await fixtures.observation(participation.id, 1, 'Corb', 1);
      await fixtures.observation(participation.id, 49, 'Mérou', 9999);
      expect(
        await dataSource.manager.countBy(DiveObservation, { participationId: participation.id }),
      ).toBe(3);
    });

    it('refuses an observation of an unknown participation', async () => {
      await expect(fixtures.observation(randomUUID(), 0, 'Corb')).rejects.toEqual(
        violating('fk_dive_observations__participation_id'),
      );
    });
  });

  it('requires stops_ok: no default value', async () => {
    const { diver, event } = await newEvent();
    await expect(
      dataSource.manager.insert(DiveParticipation, {
        id: randomUUID(),
        diveEventId: event.id,
        diverId: diver.id,
        certificationLevelId: diver.certificationLevelId,
        maxDepthM: 20,
        durationMin: 40,
        gasMix: 'AIR',
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        driverError: expect.objectContaining({ code: '23502', column: 'stops_ok' }) as unknown,
      }),
    );
  });

  describe('certification levels reference data', () => {
    it('refuses a duplicate (agency, code)', async () => {
      await expect(fixtures.addLevel({ agency: 'FFESSM', code: 'N2' })).rejects.toEqual(
        violating('uq_certification_levels__agency_code'),
      );
    });

    it('refuses to delete a level used as a current level', async () => {
      const level = await fixtures.addLevel();
      await fixtures.diver({ certificationLevelId: level.id });
      await expect(dataSource.manager.delete(CertificationLevel, { id: level.id })).rejects.toEqual(
        violating('fk_divers__certification_level_id'),
      );
    });

    it('refuses to delete a level used by a buddy (RESTRICT), even a deactivated one', async () => {
      const level = await fixtures.addLevel({ isActive: false });
      const diver = await fixtures.diver();
      await fixtures.buddy(diver.id, { certificationLevelId: level.id });
      await expect(dataSource.manager.delete(CertificationLevel, { id: level.id })).rejects.toEqual(
        violating('fk_buddies__certification_level_id'),
      );
    });

    it('refuses a buddy level that does not exist', async () => {
      const diver = await fixtures.diver();
      await expect(
        fixtures.buddy(diver.id, { certificationLevelId: randomUUID() }),
      ).rejects.toEqual(violating('fk_buddies__certification_level_id'));
    });

    it('refuses to delete a level used by a participation snapshot', async () => {
      const level = await fixtures.addLevel();
      const { diver, event } = await newEvent();
      await fixtures.participation(event.id, diver.id, { certificationLevelId: level.id });
      await expect(dataSource.manager.delete(CertificationLevel, { id: level.id })).rejects.toEqual(
        violating('fk_dive_participations__certification_level_id'),
      );
    });
  });

  describe('composite foreign keys per owner', () => {
    it("refuses an event on another diver's site", async () => {
      const alice = await fixtures.diver();
      const bob = await fixtures.diver();
      const bobSite = await fixtures.site(bob.id);
      await expect(fixtures.event(alice.id, bobSite.id)).rejects.toEqual(
        violating('fk_dive_events__creator_id_site_id'),
      );
    });

    it("refuses a dive team line with another diver's buddy", async () => {
      const alice = await fixtures.diver();
      const bob = await fixtures.diver();
      const { participation } = await fixtures.dive(alice.id);
      const bobBuddy = await fixtures.buddy(bob.id);
      await expect(fixtures.diveBuddy(alice.id, participation.id, bobBuddy.id)).rejects.toEqual(
        violating('fk_dive_buddies__owner_id_buddy_id'),
      );
    });

    it("refuses a dive team line on another diver's participation", async () => {
      const alice = await fixtures.diver();
      const bob = await fixtures.diver();
      const { participation: bobParticipation } = await fixtures.dive(bob.id);
      const aliceBuddy = await fixtures.buddy(alice.id);
      await expect(
        fixtures.diveBuddy(alice.id, bobParticipation.id, aliceBuddy.id),
      ).rejects.toEqual(violating('fk_dive_buddies__owner_id_participation_id'));
    });
  });

  it('refuses a second participation of a diver in an event, even tombstoned', async () => {
    const { diver, event } = await newEvent();
    await fixtures.participation(event.id, diver.id, { deletedAt: new Date() });
    await expect(fixtures.participation(event.id, diver.id)).rejects.toEqual(
      violating('uq_dive_participations__dive_event_id_diver_id'),
    );
  });

  it('links an account to a single live contact of the same owner', async () => {
    const owner = await fixtures.diver();
    const linked = await fixtures.diver();
    const first = await fixtures.buddy(owner.id, { linkedDiverId: linked.id });

    await expect(fixtures.buddy(owner.id, { linkedDiverId: linked.id })).rejects.toEqual(
      violating('uq_buddies__owner_id_linked_diver_id'),
    );

    await dataSource.manager.update(Buddy, { id: first.id }, { deletedAt: new Date() });
    await expect(fixtures.buddy(owner.id, { linkedDiverId: linked.id })).resolves.toBeDefined();
  });

  describe('triggers', () => {
    it('sets updated_at on insert and update, ignoring a provided value', async () => {
      const diver = await fixtures.diver();
      const siteId = randomUUID();
      await dataSource.query(
        `INSERT INTO dive_sites (id, owner_id, name, region, latitude, longitude, updated_at)
         VALUES ($1, $2, 'Site', 'Région', 43, 5, '2000-01-01T00:00:00Z')`,
        [siteId, diver.id],
      );
      const inserted = await updatedAtOf(dataSource, 'dive_sites', siteId);
      expect(inserted.startsWith('2000')).toBe(false);

      await dataSource.query(
        "UPDATE dive_sites SET name = 'Renamed', updated_at = '2000-01-01T00:00:00Z' WHERE id = $1",
        [siteId],
      );
      const updated = await updatedAtOf(dataSource, 'dive_sites', siteId);
      expect(updated.startsWith('2000')).toBe(false);
      expect(updated > inserted).toBe(true);
    });

    it('touches the participation when its dive team changes', async () => {
      const diver = await fixtures.diver();
      const buddy = await fixtures.buddy(diver.id);
      const { participation } = await fixtures.dive(diver.id);
      const initial = await updatedAtOf(dataSource, 'dive_participations', participation.id);

      await fixtures.diveBuddy(diver.id, participation.id, buddy.id);
      const afterAdd = await updatedAtOf(dataSource, 'dive_participations', participation.id);
      expect(afterAdd > initial).toBe(true);

      await dataSource.manager.delete(DiveBuddy, { participationId: participation.id });
      const afterRemove = await updatedAtOf(dataSource, 'dive_participations', participation.id);
      expect(afterRemove > afterAdd).toBe(true);
    });

    it('touches the participation when an observation is added, changed or removed', async () => {
      const diver = await fixtures.diver();
      const { participation } = await fixtures.dive(diver.id);
      const touched = () => updatedAtOf(dataSource, 'dive_participations', participation.id);
      const initial = await touched();

      await fixtures.observation(participation.id, 0, 'Murène');
      const afterAdd = await touched();
      expect(afterAdd > initial).toBe(true);

      await dataSource.manager.update(
        DiveObservation,
        { participationId: participation.id, position: 0 },
        { count: 2 },
      );
      const afterUpdate = await touched();
      expect(afterUpdate > afterAdd).toBe(true);

      await dataSource.manager.delete(DiveObservation, { participationId: participation.id });
      const afterRemove = await touched();
      expect(afterRemove > afterUpdate).toBe(true);
    });
  });

  it('cascade + trigger, case 1: deleting an account erases everything and unlinks contacts', async () => {
    const leaving = await fixtures.diver();
    const other = await fixtures.diver();
    const buddy = await fixtures.buddy(leaving.id);
    const { participation } = await fixtures.dive(leaving.id, [buddy.id]);
    await fixtures.observation(participation.id, 0, 'Murène');
    const othersContact = await fixtures.buddy(other.id, { linkedDiverId: leaving.id });

    await dataSource.manager.delete(Diver, { id: leaving.id });

    const counts = await selectRows<Record<string, string>>(
      dataSource,
      `SELECT (SELECT count(*) FROM dive_sites WHERE owner_id = $1) AS sites,
              (SELECT count(*) FROM buddies WHERE owner_id = $1) AS buddies,
              (SELECT count(*) FROM dive_events WHERE creator_id = $1) AS events,
              (SELECT count(*) FROM dive_participations WHERE diver_id = $1) AS participations,
              (SELECT count(*) FROM dive_buddies WHERE owner_id = $1) AS team_lines,
              (SELECT count(*) FROM dive_observations WHERE participation_id = $2) AS observations`,
      [leaving.id, participation.id],
    );
    expect(counts).toEqual([
      {
        sites: '0',
        buddies: '0',
        events: '0',
        participations: '0',
        team_lines: '0',
        observations: '0',
      },
    ]);
    expect(await dataSource.manager.findOneByOrFail(Buddy, { id: othersContact.id })).toMatchObject(
      { linkedDiverId: null },
    );
  });

  it('cascade + trigger, case 2: physical deletion of a participation with a dive team, then its event and site', async () => {
    const diver = await fixtures.diver();
    const buddy = await fixtures.buddy(diver.id);
    const { site, event, participation } = await fixtures.dive(diver.id, [buddy.id]);
    await fixtures.observation(participation.id, 0, 'Murène');
    await fixtures.observation(participation.id, 1, 'Corb', 3);

    await dataSource.manager.delete(DiveParticipation, { id: participation.id });
    await dataSource.manager.delete(DiveEvent, { id: event.id });
    await dataSource.manager.delete(DiveSite, { id: site.id });

    expect(await dataSource.manager.countBy(DiveBuddy, { participationId: participation.id })).toBe(
      0,
    );
    expect(
      await dataSource.manager.countBy(DiveObservation, { participationId: participation.id }),
    ).toBe(0);
    expect(await dataSource.manager.existsBy(Buddy, { id: buddy.id })).toBe(true);
  });

  it('refuses to physically delete a site still used by an event (RESTRICT)', async () => {
    const { site } = await newEvent();
    await expect(dataSource.manager.delete(DiveSite, { id: site.id })).rejects.toEqual(
      violating('fk_dive_events__creator_id_site_id'),
    );
  });
});
