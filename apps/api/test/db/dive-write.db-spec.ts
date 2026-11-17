import { randomUUID } from 'node:crypto';
import type { DiveWriteBuddy, DiveWriteRequest } from '@e-deep/shared';
import { NotFoundException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import {
  IdentifierConflictError,
  InvalidReferenceError,
} from '../../src/common/errors/domain-errors';
import { Buddy } from '../../src/modules/buddies/buddy.entity';
import { BuddiesService } from '../../src/modules/buddies/buddies.service';
import { DashboardService } from '../../src/modules/dashboard/dashboard.service';
import { DiveSite } from '../../src/modules/dive-sites/dive-site.entity';
import { DiveSitesService } from '../../src/modules/dive-sites/dive-sites.service';
import { Diver } from '../../src/modules/divers/diver.entity';
import { DiveEvent } from '../../src/modules/dives/dive-event.entity';
import { DiveLogService } from '../../src/modules/dives/dive-log.service';
import { DiveParticipation } from '../../src/modules/dives/dive-participation.entity';
import { DiveWriteService } from '../../src/modules/dives/dive-write.service';
import { DivesService } from '../../src/modules/dives/dives.service';
import { diveWriteRequest, type DiveWriteRequestOverrides } from '../support/dive-write-request';
import { Fixtures, SYNC_SETTINGS_90_DAYS } from './support/fixtures';
import { selectRows, updatedAtOf } from './support/sql';
import { createTestDataSource, resetDatabase } from './support/test-database';

describe('DiveWriteService', () => {
  let dataSource: DataSource;
  let fixtures: Fixtures;
  let service: DiveWriteService;
  let diveLog: DiveLogService;

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    fixtures = new Fixtures(dataSource);
    diveLog = new DiveLogService(dataSource);
    service = new DiveWriteService(
      dataSource,
      new DivesService(dataSource, SYNC_SETTINGS_90_DAYS),
      new DiveSitesService(dataSource, SYNC_SETTINGS_90_DAYS),
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

  async function diverWithSite(levelCode = 'N1') {
    const diver = await fixtures.diver({ certificationLevelId: await fixtures.levelId(levelCode) });
    const site = await fixtures.site(diver.id);
    return { diver, site };
  }

  function newBuddy(values: Partial<DiveWriteBuddy> = {}): DiveWriteBuddy {
    return {
      id: randomUUID(),
      firstName: 'Thao',
      lastName: 'Nguyen',
      levelCode: null,
      isNew: true,
      ...values,
    };
  }

  /** A request on a site created by its name, with a new buddy. */
  function requestWithNewContacts(overrides: DiveWriteRequestOverrides = {}): DiveWriteRequest {
    return diveWriteRequest({
      site: { name: 'Tombant des Américains', isNew: true },
      buddies: [newBuddy({ levelCode: 'N3' })],
      observations: [{ label: ' Mérou brun ', count: 2 }],
      ...overrides,
    });
  }

  async function counts() {
    const [row] = await selectRows<Record<string, number>>(
      dataSource,
      `SELECT (SELECT count(*)::int FROM dive_sites) AS sites,
              (SELECT count(*)::int FROM buddies) AS buddies,
              (SELECT count(*)::int FROM dive_events) AS events,
              (SELECT count(*)::int FROM dive_participations) AS participations,
              (SELECT count(*)::int FROM dive_buddies) AS team,
              (SELECT count(*)::int FROM dive_observations) AS observations`,
    );
    return row;
  }

  describe('create', () => {
    it('creates the site and the buddy by name, then the dive, in one transaction', async () => {
      const { diver } = await diverWithSite('N2');
      const buddy = newBuddy({ levelCode: 'N3' });
      const request = requestWithNewContacts({ buddies: [buddy] });

      const creation = await service.create(diver.id, request);

      expect(creation).toEqual({
        outcome: 'created',
        saved: { id: request.event.id, number: 1, updatedAt: expect.any(String) as unknown },
      });
      expect(
        await dataSource.manager.findOneByOrFail(DiveSite, { id: request.site.id }),
      ).toMatchObject({
        ownerId: diver.id,
        name: 'Tombant des Américains',
        locality: null,
        region: null,
        area: null,
        latitude: null,
        longitude: null,
      });
      expect(await dataSource.manager.findOneByOrFail(Buddy, { id: buddy.id })).toMatchObject({
        ownerId: diver.id,
        firstName: 'Thao',
        certificationLevelId: await fixtures.levelId('N3'),
      });
      const participation = await dataSource.manager.findOneByOrFail(DiveParticipation, {
        diveEventId: request.event.id,
      });
      // No snapshot sent: the diver's current level (D-09).
      expect(participation.certificationLevelId).toBe(await fixtures.levelId('N2'));

      const detail = await diveLog.findOne(diver.id, request.event.id);
      expect(detail).toMatchObject({
        number: 1,
        date: '2026-04-09T10:05:00+02:00',
        site: { id: request.site.id, region: null, latitude: null, longitude: null, area: null },
        buddies: [{ id: buddy.id, level: { code: 'N3' } }],
        observations: [{ label: 'Mérou brun', count: 2 }],
      });
      expect(creation.saved.updatedAt).toBe(detail.updatedAt);
    });

    it('rolls everything back when the buddy level is unknown, after the site was created', async () => {
      const { diver } = await diverWithSite();
      const request = requestWithNewContacts({ buddies: [newBuddy({ levelCode: 'MF2' })] });

      await expect(service.create(diver.id, request)).rejects.toThrow(InvalidReferenceError);

      expect(await counts()).toMatchObject({ sites: 1, buddies: 0, events: 0, participations: 0 });
    });

    it("rolls everything back when the dive uses another diver's buddy", async () => {
      const { diver } = await diverWithSite();
      const other = await fixtures.diver();
      const foreignBuddy = await fixtures.buddy(other.id);
      const request = requestWithNewContacts({
        buddies: [
          newBuddy(),
          {
            id: foreignBuddy.id,
            firstName: 'Sam',
            lastName: 'Durand',
            levelCode: null,
            isNew: false,
          },
        ],
      });

      await expect(service.create(diver.id, request)).rejects.toThrow(InvalidReferenceError);

      // The fixture site of the diver and the other diver's buddy only.
      expect(await counts()).toMatchObject({ sites: 1, buddies: 1, events: 0, participations: 0 });
    });

    it('refuses an existing site of another diver (422), creating nothing', async () => {
      const { diver } = await diverWithSite();
      const other = await diverWithSite();
      const request = diveWriteRequest({
        event: { siteId: other.site.id },
        buddies: [newBuddy()],
      });

      await expect(service.create(diver.id, request)).rejects.toThrow(InvalidReferenceError);
      expect(await counts()).toMatchObject({ buddies: 0, events: 0 });
    });

    it("refuses a new site carrying the id of another diver's site (409)", async () => {
      const { diver } = await diverWithSite();
      const other = await diverWithSite();
      const request = diveWriteRequest({
        event: { siteId: other.site.id },
        site: { name: 'Mine', isNew: true },
      });

      await expect(service.create(diver.id, request)).rejects.toThrow(IdentifierConflictError);
      expect(
        await dataSource.manager.findOneByOrFail(DiveSite, { id: other.site.id }),
      ).toMatchObject({
        ownerId: other.diver.id,
        name: 'La Vesse',
      });
    });

    it('answers a replayed creation without writing anything', async () => {
      const { diver } = await diverWithSite();
      const request = requestWithNewContacts();
      const first = await service.create(diver.id, request);
      const before = await counts();
      const eventUpdatedAt = await updatedAtOf(dataSource, 'dive_events', request.event.id);
      const siteUpdatedAt = await updatedAtOf(dataSource, 'dive_sites', request.site.id);

      const replay = await service.create(diver.id, {
        ...request,
        observations: [{ label: 'Mérou brun', count: 2 }],
        buddies: request.buddies.map((buddy) => ({ ...buddy, id: buddy.id.toUpperCase() })),
      });

      expect(replay).toEqual({ outcome: 'replayed', saved: first.saved });
      expect(await counts()).toEqual(before);
      expect(await updatedAtOf(dataSource, 'dive_events', request.event.id)).toBe(eventUpdatedAt);
      expect(await updatedAtOf(dataSource, 'dive_sites', request.site.id)).toBe(siteUpdatedAt);
    });

    it('does not overwrite a site enriched between a creation and its replay', async () => {
      const { diver } = await diverWithSite();
      const request = requestWithNewContacts();
      await service.create(diver.id, request);
      await dataSource.manager.update(
        DiveSite,
        { id: request.site.id },
        { region: 'Var', latitude: 43.01, longitude: 6.4 },
      );

      await service.create(diver.id, request);

      expect(
        await dataSource.manager.findOneByOrFail(DiveSite, { id: request.site.id }),
      ).toMatchObject({
        region: 'Var',
        latitude: 43.01,
      });
    });

    it('refuses an id already taken by another content, a deleted dive or another diver', async () => {
      const { diver, site } = await diverWithSite();
      const other = await diverWithSite();
      const request = diveWriteRequest({ event: { siteId: site.id } });
      await service.create(diver.id, request);

      const changed = { ...request, participation: { ...request.participation, durationMin: 40 } };
      await expect(service.create(diver.id, changed)).rejects.toThrow(IdentifierConflictError);

      const othersRequest = diveWriteRequest({
        event: { id: request.event.id, siteId: other.site.id },
      });
      await expect(service.create(other.diver.id, othersRequest)).rejects.toThrow(
        IdentifierConflictError,
      );

      await new DivesService(dataSource, SYNC_SETTINGS_90_DAYS).deleteDive(
        diver.id,
        request.event.id,
      );
      await expect(service.create(diver.id, request)).rejects.toThrow(IdentifierConflictError);

      expect(await dataSource.manager.findOneByOrFail(DiveParticipation, {})).toMatchObject({
        durationMin: 52,
      });
    });

    it('serialises two concurrent identical creations: one created, one replayed', async () => {
      const { diver } = await diverWithSite();
      const request = requestWithNewContacts();

      const outcomes = await Promise.all([
        service.create(diver.id, request),
        service.create(diver.id, request),
      ]);

      expect(outcomes.map(({ outcome }) => outcome).sort()).toEqual(['created', 'replayed']);
      expect(await counts()).toMatchObject({
        sites: 2,
        buddies: 1,
        events: 1,
        participations: 1,
        team: 1,
        observations: 1,
      });
    });

    it('serialises two concurrent different creations: one succeeds, the other conflicts', async () => {
      const { diver } = await diverWithSite();
      const request = requestWithNewContacts();
      const different = {
        ...request,
        participation: { ...request.participation, durationMin: 40 },
      };

      const results = await Promise.allSettled([
        service.create(diver.id, request),
        service.create(diver.id, different),
      ]);

      const fulfilled = results.filter((result) => result.status === 'fulfilled');
      const rejected = results.filter((result) => result.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(fulfilled[0]?.value.outcome).toBe('created');
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(IdentifierConflictError);
      expect(await counts()).toMatchObject({ events: 1, participations: 1 });
    });

    it('answers the number of the dive among earlier and later ones (D26)', async () => {
      const { diver, site } = await diverWithSite();
      for (const startedAt of [
        '2026-01-10T08:00:00Z',
        '2026-03-01T08:00:00Z',
        '2026-06-01T08:00:00Z',
      ]) {
        const event = await fixtures.event(diver.id, site.id, { startedAt: new Date(startedAt) });
        await fixtures.participation(event.id, diver.id);
      }
      // A tombstoned earlier dive is not counted.
      const deleted = await fixtures.event(diver.id, site.id, {
        startedAt: new Date('2026-02-01T08:00:00Z'),
        deletedAt: new Date(),
      });
      await fixtures.participation(deleted.id, diver.id);

      const { saved } = await service.create(
        diver.id,
        diveWriteRequest({ event: { siteId: site.id, startedAt: '2026-04-09T10:05:00+02:00' } }),
      );

      expect(saved.number).toBe(3);
    });
  });

  describe('replace', () => {
    it('replaces the dive, keeping its participation and level snapshot (D-09)', async () => {
      const { diver, site } = await diverWithSite('N1');
      const request = diveWriteRequest({ event: { siteId: site.id } });
      await service.create(diver.id, request);
      const { id: participationId } = await dataSource.manager.findOneByOrFail(
        DiveParticipation,
        {},
      );
      await dataSource.manager.update(
        Diver,
        { id: diver.id },
        { certificationLevelId: await fixtures.levelId('N4') },
      );
      const detail = await diveLog.findOne(diver.id, request.event.id);

      const saved = await service.replace(diver.id, request.event.id, {
        ...request,
        participation: { ...request.participation, maxDepthM: 40.5, notes: 'Retour au bateau' },
        observations: [{ label: 'Corb', count: null }],
        baseUpdatedAt: detail.updatedAt,
      });

      expect(saved).toMatchObject({ id: request.event.id, number: 1 });
      const participations = await dataSource.manager.find(DiveParticipation);
      expect(participations).toHaveLength(1);
      expect(participations[0]).toMatchObject({
        id: participationId,
        maxDepthM: 40.5,
        notes: 'Retour au bateau',
        certificationLevelId: await fixtures.levelId('N1'),
      });
      expect((await diveLog.findOne(diver.id, request.event.id)).observations).toEqual([
        { label: 'Corb', count: null },
      ]);
    });

    it("answers 404 for a deleted dive, another diver's dive or an unknown id, writing nothing", async () => {
      const { diver, site } = await diverWithSite();
      const other = await diverWithSite();
      const request = diveWriteRequest({ event: { siteId: site.id } });
      await service.create(diver.id, request);
      const otherRequest = diveWriteRequest({ event: { siteId: other.site.id } });
      await service.create(other.diver.id, otherRequest);
      await new DivesService(dataSource, SYNC_SETTINGS_90_DAYS).deleteDive(
        diver.id,
        request.event.id,
      );
      const unknown = diveWriteRequest({ event: { siteId: site.id } });

      for (const [id, body] of [
        [request.event.id, request],
        [
          otherRequest.event.id,
          { ...otherRequest, event: { ...otherRequest.event, siteId: site.id } },
        ],
        [unknown.event.id, unknown],
      ] as const) {
        await expect(service.replace(diver.id, id, body)).rejects.toThrow(NotFoundException);
      }

      expect(
        await dataSource.manager.findOneByOrFail(DiveEvent, { id: request.event.id }),
      ).toMatchObject({
        deletedAt: expect.any(Date) as unknown,
      });
      expect(await dataSource.manager.countBy(DiveEvent, { id: unknown.event.id })).toBe(0);
    });

    it('updates the level of an existing buddy (D-21), and keeps it when none is given', async () => {
      const { diver, site } = await diverWithSite();
      const buddy = await fixtures.buddy(diver.id, { firstName: 'Lucas' });
      const asMember = (levelCode: string | null): DiveWriteBuddy => ({
        id: buddy.id,
        firstName: 'Ignored',
        lastName: 'Ignored',
        levelCode,
        isNew: false,
      });
      const request = diveWriteRequest({ event: { siteId: site.id }, buddies: [asMember('N3')] });
      await service.create(diver.id, request);

      expect(await dataSource.manager.findOneByOrFail(Buddy, { id: buddy.id })).toMatchObject({
        firstName: 'Lucas',
        certificationLevelId: await fixtures.levelId('N3'),
      });

      await service.replace(diver.id, request.event.id, { ...request, buddies: [asMember(null)] });

      expect(await dataSource.manager.findOneByOrFail(Buddy, { id: buddy.id })).toMatchObject({
        certificationLevelId: await fixtures.levelId('N3'),
      });
    });
  });

  it('serves a site without region nor position on the dashboard, out of the main region', async () => {
    const { diver } = await diverWithSite();
    await service.create(diver.id, requestWithNewContacts());

    const dashboard = await new DashboardService(dataSource).getDashboard(diver.id);

    expect(dashboard.sites).toEqual([
      expect.objectContaining({ name: 'Tombant des Américains', region: null, latitude: null }),
    ]);
    expect(dashboard.stats.mainRegion).toBeNull();
    expect(dashboard.lastDive?.site.region).toBeNull();
  });
});
