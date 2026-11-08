import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { Buddy } from '../../src/modules/buddies/buddy.entity';
import { CertificationLevel } from '../../src/modules/certification-levels/certification-level.entity';
import { DiveSite } from '../../src/modules/dive-sites/dive-site.entity';
import { Diver } from '../../src/modules/divers/diver.entity';
import { DiveBuddy } from '../../src/modules/dives/dive-buddy.entity';
import { DiveEvent } from '../../src/modules/dives/dive-event.entity';
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
  });

  it('cascade + trigger, case 1: deleting an account erases everything and unlinks contacts', async () => {
    const leaving = await fixtures.diver();
    const other = await fixtures.diver();
    const buddy = await fixtures.buddy(leaving.id);
    await fixtures.dive(leaving.id, [buddy.id]);
    const othersContact = await fixtures.buddy(other.id, { linkedDiverId: leaving.id });

    await dataSource.manager.delete(Diver, { id: leaving.id });

    const counts = await selectRows<Record<string, string>>(
      dataSource,
      `SELECT (SELECT count(*) FROM dive_sites WHERE owner_id = $1) AS sites,
              (SELECT count(*) FROM buddies WHERE owner_id = $1) AS buddies,
              (SELECT count(*) FROM dive_events WHERE creator_id = $1) AS events,
              (SELECT count(*) FROM dive_participations WHERE diver_id = $1) AS participations,
              (SELECT count(*) FROM dive_buddies WHERE owner_id = $1) AS team_lines`,
      [leaving.id],
    );
    expect(counts).toEqual([
      { sites: '0', buddies: '0', events: '0', participations: '0', team_lines: '0' },
    ]);
    expect(await dataSource.manager.findOneByOrFail(Buddy, { id: othersContact.id })).toMatchObject(
      { linkedDiverId: null },
    );
  });

  it('cascade + trigger, case 2: physical deletion of a participation with a dive team, then its event and site', async () => {
    const diver = await fixtures.diver();
    const buddy = await fixtures.buddy(diver.id);
    const { site, event, participation } = await fixtures.dive(diver.id, [buddy.id]);

    await dataSource.manager.delete(DiveParticipation, { id: participation.id });
    await dataSource.manager.delete(DiveEvent, { id: event.id });
    await dataSource.manager.delete(DiveSite, { id: site.id });

    expect(await dataSource.manager.countBy(DiveBuddy, { participationId: participation.id })).toBe(
      0,
    );
    expect(await dataSource.manager.existsBy(Buddy, { id: buddy.id })).toBe(true);
  });

  it('refuses to physically delete a site still used by an event (RESTRICT)', async () => {
    const { site } = await newEvent();
    await expect(dataSource.manager.delete(DiveSite, { id: site.id })).rejects.toEqual(
      violating('fk_dive_events__creator_id_site_id'),
    );
  });
});
