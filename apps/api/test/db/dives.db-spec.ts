import { randomUUID } from 'node:crypto';
import type { DataSource } from 'typeorm';
import {
  DuplicateObservationError,
  FullSyncRequiredError,
  IdentifierConflictError,
  InvalidReferenceError,
  TooManyObservationsError,
} from '../../src/common/errors/domain-errors';
import { Buddy } from '../../src/modules/buddies/buddy.entity';
import { DiveSite } from '../../src/modules/dive-sites/dive-site.entity';
import { DiversService } from '../../src/modules/divers/divers.service';
import { DiveEvent } from '../../src/modules/dives/dive-event.entity';
import { DiveObservation } from '../../src/modules/dives/dive-observation.entity';
import { DiveParticipation } from '../../src/modules/dives/dive-participation.entity';
import { DivesService } from '../../src/modules/dives/dives.service';
import { diveWrite, Fixtures, recentPull, SYNC_SETTINGS_90_DAYS } from './support/fixtures';
import { selectRows } from './support/sql';
import { createTestDataSource, resetDatabase } from './support/test-database';

const DAY = 86_400_000;

describe('DivesService', () => {
  let dataSource: DataSource;
  let fixtures: Fixtures;
  let dives: DivesService;
  let divers: DiversService;

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    fixtures = new Fixtures(dataSource);
    dives = new DivesService(dataSource, SYNC_SETTINGS_90_DAYS);
    divers = new DiversService(dataSource);
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

  describe('upsertDive', () => {
    it('writes the event, the participation and the dive team', async () => {
      const { diver, site } = await diverWithSite();
      const buddy = await fixtures.buddy(diver.id);
      const write = diveWrite(site.id, { buddyIds: [buddy.id, buddy.id] });

      const result = await dives.upsertDive(diver.id, write, recentPull());

      expect(result).toMatchObject({
        status: 'applied',
        current: {
          event: {
            id: write.event.id,
            creatorId: diver.id,
            siteId: site.id,
            utcOffsetMinutes: 120,
          },
          participation: {
            id: write.participation.id,
            diverId: diver.id,
            maxDepthM: 32.5,
            gasMix: 'NITROX32',
            stopsOk: true,
          },
          buddyIds: [buddy.id],
        },
      });
    });

    it('replaces the dive team', async () => {
      const { diver, site } = await diverWithSite();
      const [first, second, third] = await Promise.all([
        fixtures.buddy(diver.id),
        fixtures.buddy(diver.id),
        fixtures.buddy(diver.id),
      ]);
      const write = diveWrite(site.id, { buddyIds: [first.id, second.id] });
      await dives.upsertDive(diver.id, write, recentPull());

      const result = await dives.upsertDive(
        diver.id,
        { ...write, buddyIds: [second.id, third.id] },
        recentPull(),
      );

      expect([...result.current.buddyIds].sort()).toEqual([second.id, third.id].sort());
    });

    it('writes nothing when a part of the aggregate fails', async () => {
      const { diver, site } = await diverWithSite();
      const write = diveWrite(site.id, { participation: { maxDepthM: 500 } });

      await expect(dives.upsertDive(diver.id, write, recentPull())).rejects.toBeDefined();

      expect(await dataSource.manager.existsBy(DiveEvent, { id: write.event.id })).toBe(false);
      expect(await dataSource.manager.count(DiveParticipation)).toBe(0);
    });

    it("refuses another diver's event id", async () => {
      const alice = await diverWithSite();
      const bob = await diverWithSite();
      const bobDive = diveWrite(bob.site.id);
      await dives.upsertDive(bob.diver.id, bobDive, recentPull());

      await expect(
        dives.upsertDive(
          alice.diver.id,
          diveWrite(alice.site.id, { event: { id: bobDive.event.id } }),
          recentPull(),
        ),
      ).rejects.toThrow(IdentifierConflictError);
    });

    it("refuses another diver's participation id", async () => {
      const alice = await diverWithSite();
      const bob = await diverWithSite();
      const bobDive = diveWrite(bob.site.id);
      await dives.upsertDive(bob.diver.id, bobDive, recentPull());

      await expect(
        dives.upsertDive(
          alice.diver.id,
          diveWrite(alice.site.id, { participation: { id: bobDive.participation.id } }),
          recentPull(),
        ),
      ).rejects.toThrow(IdentifierConflictError);
    });

    it("refuses another diver's site or buddy", async () => {
      const alice = await diverWithSite();
      const bob = await diverWithSite();
      const bobBuddy = await fixtures.buddy(bob.diver.id);

      await expect(
        dives.upsertDive(alice.diver.id, diveWrite(bob.site.id), recentPull()),
      ).rejects.toThrow(InvalidReferenceError);
      await expect(
        dives.upsertDive(
          alice.diver.id,
          diveWrite(alice.site.id, { buddyIds: [bobBuddy.id] }),
          recentPull(),
        ),
      ).rejects.toThrow(InvalidReferenceError);
    });

    it('requires a full sync when the last pull predates the purge horizon', async () => {
      const { diver, site } = await diverWithSite();
      await expect(
        dives.upsertDive(diver.id, diveWrite(site.id), new Date(Date.now() - 91 * DAY)),
      ).rejects.toThrow(FullSyncRequiredError);
    });

    it('restores a tombstoned site and buddies referenced by a live dive', async () => {
      const { diver, site } = await diverWithSite();
      const buddy = await fixtures.buddy(diver.id, { deletedAt: new Date() });
      await dataSource.manager.update(DiveSite, { id: site.id }, { deletedAt: new Date() });

      await dives.upsertDive(diver.id, diveWrite(site.id, { buddyIds: [buddy.id] }), recentPull());

      expect(await dataSource.manager.findOneByOrFail(DiveSite, { id: site.id })).toMatchObject({
        deletedAt: null,
      });
      expect(await dataSource.manager.findOneByOrFail(Buddy, { id: buddy.id })).toMatchObject({
        deletedAt: null,
      });
    });

    it('restores a tombstoned participation of the same event instead of recreating it', async () => {
      const { diver, site } = await diverWithSite();
      const write = diveWrite(site.id);
      await dives.upsertDive(diver.id, write, recentPull());
      await dives.deleteDive(diver.id, write.event.id);
      const event = await dataSource.manager.findOneByOrFail(DiveEvent, { id: write.event.id });
      const participation = await dataSource.manager.findOneByOrFail(DiveParticipation, {
        id: write.participation.id,
      });

      const result = await dives.upsertDive(
        diver.id,
        diveWrite(site.id, {
          event: { id: event.id, baseUpdatedAt: event.updatedAt },
          participation: { id: randomUUID(), baseUpdatedAt: participation.updatedAt },
        }),
        recentPull(),
      );

      expect(result).toMatchObject({
        status: 'applied',
        current: {
          event: { deletedAt: null },
          participation: { id: participation.id, deletedAt: null },
        },
      });
      expect(await dataSource.manager.count(DiveParticipation)).toBe(1);
    });

    it('rejects a late device reviving a deleted dive, accepts an up-to-date restore', async () => {
      const { diver, site } = await diverWithSite();
      const write = diveWrite(site.id);
      const created = await dives.upsertDive(diver.id, write, recentPull());
      await dives.deleteDive(diver.id, write.event.id);

      const late = await dives.upsertDive(
        diver.id,
        {
          ...write,
          event: { ...write.event, baseUpdatedAt: created.current.event.updatedAt },
          participation: {
            ...write.participation,
            maxDepthM: 40,
            baseUpdatedAt: created.current.participation.updatedAt,
          },
        },
        recentPull(),
      );
      expect(late.status).toBe('rejected');
      expect(late.current.participation).toMatchObject({ maxDepthM: 32.5 });
      expect(late.current.event.deletedAt).toBeInstanceOf(Date);

      const restored = await dives.upsertDive(
        diver.id,
        {
          ...write,
          event: { ...write.event, baseUpdatedAt: late.current.event.updatedAt },
          participation: {
            ...write.participation,
            baseUpdatedAt: late.current.participation.updatedAt,
          },
        },
        recentPull(),
      );
      expect(restored).toMatchObject({
        status: 'applied',
        current: { event: { deletedAt: null }, participation: { deletedAt: null } },
      });
    });
  });

  describe('detail fields and observations', () => {
    const CONDITIONS = {
      entryType: 'BOAT',
      timeOfDay: 'DAY',
      weather: 'SUNNY',
      airTemperatureC: 19,
      seaState: 'CALM',
      currentStrength: 'WEAK',
      diveCenter: 'Calvi Plongée',
    } as const;
    const DETAIL = {
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
    } as const;

    it('writes the conditions and the detail, then a null erases them', async () => {
      const { diver, site } = await diverWithSite();
      const write = diveWrite(site.id, { event: CONDITIONS, participation: DETAIL });

      const created = await dives.upsertDive(diver.id, write, recentPull());
      expect(created.current.event).toMatchObject(CONDITIONS);
      expect(created.current.participation).toMatchObject(DETAIL);

      const erased = await dives.upsertDive(
        diver.id,
        diveWrite(site.id, {
          event: { id: write.event.id, diveCenter: null, airTemperatureC: null },
          participation: { id: write.participation.id, weightKg: null },
        }),
        recentPull(),
      );
      expect(erased.current.event).toMatchObject({ diveCenter: null, airTemperatureC: null });
      expect(erased.current.participation).toMatchObject({ weightKg: null, o2Percent: null });
    });

    it('replaces the observations in order, labels trimmed', async () => {
      const { diver, site } = await diverWithSite();
      const write = diveWrite(site.id, {
        observations: [
          { label: ' Mérou brun ', count: 2 },
          { label: 'Barracudas', count: null },
          { label: 'Murène', count: null },
        ],
      });
      const created = await dives.upsertDive(diver.id, write, recentPull());
      expect(created.current.observations).toStrictEqual([
        { label: 'Mérou brun', count: 2 },
        { label: 'Barracudas', count: null },
        { label: 'Murène', count: null },
      ]);

      const replaced = await dives.upsertDive(
        diver.id,
        {
          ...write,
          observations: [
            { label: 'Murène', count: 1 },
            { label: 'Mérou brun', count: 3 },
          ],
        },
        recentPull(),
      );
      expect(replaced.current.observations).toStrictEqual([
        { label: 'Murène', count: 1 },
        { label: 'Mérou brun', count: 3 },
      ]);
      const stored = await dataSource.manager.find(DiveObservation, {
        where: { participationId: write.participation.id },
        order: { position: 'ASC' },
      });
      expect(stored.map(({ position, label }) => [position, label])).toStrictEqual([
        [0, 'Murène'],
        [1, 'Mérou brun'],
      ]);

      const cleared = await dives.upsertDive(
        diver.id,
        { ...write, observations: [] },
        recentPull(),
      );
      expect(cleared.current.observations).toStrictEqual([]);
      expect(await dataSource.manager.count(DiveObservation)).toBe(0);
    });

    it('keeps the case of a label (D-19)', async () => {
      const { diver, site } = await diverWithSite();
      const result = await dives.upsertDive(
        diver.id,
        diveWrite(site.id, {
          observations: [
            { label: 'Murène', count: null },
            { label: 'murène', count: null },
          ],
        }),
        recentPull(),
      );
      expect(result.current.observations.map(({ label }) => label)).toStrictEqual([
        'Murène',
        'murène',
      ]);
    });

    it('accepts 50 observations', async () => {
      const { diver, site } = await diverWithSite();
      const observations = Array.from({ length: 50 }, (_unused, index) => ({
        label: `Espèce ${String(index)}`,
        count: null,
      }));
      const result = await dives.upsertDive(
        diver.id,
        diveWrite(site.id, { observations }),
        recentPull(),
      );
      expect(result.current.observations).toHaveLength(50);
    });

    it.each([
      [
        'a duplicate label once trimmed',
        [
          { label: 'Corb', count: null },
          { label: ' Corb', count: 2 },
        ],
        DuplicateObservationError,
      ],
      [
        'more than 50 observations',
        Array.from({ length: 51 }, (_unused, index) => ({
          label: `Espèce ${String(index)}`,
          count: null,
        })),
        TooManyObservationsError,
      ],
    ])('refuses %s and writes nothing', async (_case, observations, error) => {
      const { diver, site } = await diverWithSite();
      const write = diveWrite(site.id, { observations });

      await expect(dives.upsertDive(diver.id, write, recentPull())).rejects.toThrow(error);

      expect(await dataSource.manager.existsBy(DiveEvent, { id: write.event.id })).toBe(false);
      expect(await dataSource.manager.count(DiveParticipation)).toBe(0);
      expect(await dataSource.manager.count(DiveObservation)).toBe(0);
    });

    it('rolls back the dive when an observation breaks a constraint', async () => {
      const { diver, site } = await diverWithSite();
      const write = diveWrite(site.id, { observations: [{ label: 'Corb', count: 1 }] });
      await dives.upsertDive(diver.id, write, recentPull());

      await expect(
        dives.upsertDive(
          diver.id,
          {
            ...write,
            participation: { ...write.participation, maxDepthM: 12 },
            observations: [{ label: 'Corb', count: 0 }],
          },
          recentPull(),
        ),
      ).rejects.toBeDefined();

      expect(
        await dataSource.manager.findOneByOrFail(DiveParticipation, {
          id: write.participation.id,
        }),
      ).toMatchObject({ maxDepthM: 32.5 });
      expect(await dataSource.manager.find(DiveObservation)).toMatchObject([
        { label: 'Corb', count: 1 },
      ]);
    });

    it('does not rewrite unchanged observations', async () => {
      const { diver, site } = await diverWithSite();
      const write = diveWrite(site.id, { observations: [{ label: 'Corb', count: 1 }] });
      await dives.upsertDive(diver.id, write, recentPull());
      // The physical row id changes on any UPDATE or re-INSERT.
      const physicalRows = () =>
        selectRows<{ ctid: string }>(
          dataSource,
          'SELECT ctid::text AS ctid FROM dive_observations',
        );
      const before = await physicalRows();

      await dives.upsertDive(diver.id, write, recentPull());

      expect(await physicalRows()).toStrictEqual(before);
    });
  });

  describe('participation level snapshot (D-09)', () => {
    it('keeps a level sent by the client, even above the current level', async () => {
      const { diver, site } = await diverWithSite('N1');
      const n3 = await fixtures.levelId('N3');

      const result = await dives.upsertDive(
        diver.id,
        diveWrite(site.id, { participation: { certificationLevelId: n3 } }),
        recentPull(),
      );

      expect(result.current.participation.certificationLevelId).toBe(n3);
    });

    it('accepts a deactivated level', async () => {
      const { diver, site } = await diverWithSite();
      const retired = await fixtures.addLevel({ isActive: false });

      const result = await dives.upsertDive(
        diver.id,
        diveWrite(site.id, { participation: { certificationLevelId: retired.id } }),
        recentPull(),
      );

      expect(result.current.participation.certificationLevelId).toBe(retired.id);
    });

    it('copies the current level when none is sent', async () => {
      const { diver, site } = await diverWithSite('N2');

      const omitted = await dives.upsertDive(diver.id, diveWrite(site.id), recentPull());
      const nulled = await dives.upsertDive(
        diver.id,
        diveWrite(site.id, { participation: { certificationLevelId: null } }),
        recentPull(),
      );

      expect(omitted.current.participation.certificationLevelId).toBe(diver.certificationLevelId);
      expect(nulled.current.participation.certificationLevelId).toBe(diver.certificationLevelId);
    });

    it('refuses to copy the level of an incomplete profile, writes nothing (invariant)', async () => {
      const diver = await fixtures.incompleteDiver();
      const site = await fixtures.site(diver.id);
      const write = diveWrite(site.id);

      await expect(dives.upsertDive(diver.id, write, recentPull())).rejects.toThrow(
        'Incomplete diver profile: no certification level',
      );
      expect(await dataSource.manager.existsBy(DiveEvent, { id: write.event.id })).toBe(false);
    });

    it('refuses an unknown level', async () => {
      const { diver, site } = await diverWithSite();
      await expect(
        dives.upsertDive(
          diver.id,
          diveWrite(site.id, { participation: { certificationLevelId: randomUUID() } }),
          recentPull(),
        ),
      ).rejects.toThrow(InvalidReferenceError);
    });

    it('does not follow a later change of the current level', async () => {
      const { diver, site } = await diverWithSite('N1');
      const result = await dives.upsertDive(diver.id, diveWrite(site.id), recentPull());

      await divers.changeCertificationLevel(diver.id, await fixtures.levelId('N2'));

      const stored = await dataSource.manager.findOneByOrFail(DiveParticipation, {
        id: result.current.participation.id,
      });
      expect(stored.certificationLevelId).toBe(diver.certificationLevelId);
    });
  });

  it('deleteDive tombstones the event and the participation together', async () => {
    const { diver, site } = await diverWithSite();
    const write = diveWrite(site.id);
    await dives.upsertDive(diver.id, write, recentPull());

    await dives.deleteDive(diver.id, write.event.id);

    const event = await dataSource.manager.findOneByOrFail(DiveEvent, { id: write.event.id });
    const participation = await dataSource.manager.findOneByOrFail(DiveParticipation, {
      id: write.participation.id,
    });
    expect(event.deletedAt).toBeInstanceOf(Date);
    expect(participation.deletedAt).toEqual(event.deletedAt);
  });

  it('pulls events and participations with their dive team, tombstones included', async () => {
    const { diver, site } = await diverWithSite();
    const other = await diverWithSite();
    await dives.upsertDive(other.diver.id, diveWrite(other.site.id), recentPull());
    const buddy = await fixtures.buddy(diver.id);
    const kept = diveWrite(site.id, {
      buddyIds: [buddy.id],
      observations: [
        { label: 'Murène', count: null },
        { label: 'Corb', count: 2 },
      ],
    });
    const deleted = diveWrite(site.id);
    await dives.upsertDive(diver.id, kept, recentPull());
    await dives.upsertDive(diver.id, deleted, recentPull());
    await dives.deleteDive(diver.id, deleted.event.id);

    const events = await dives.pullEvents(diver.id, null);
    const participations = await dives.pullParticipations(diver.id, null);

    expect(events.items.map((event) => event.id)).toEqual([kept.event.id, deleted.event.id]);
    expect(events.nextCursor).toBeNull();
    expect(
      participations.items.map(({ participation, buddyIds, observations }) => [
        participation.id,
        buddyIds,
        observations,
      ]),
    ).toEqual([
      [
        kept.participation.id,
        [buddy.id],
        [
          { label: 'Murène', count: null },
          { label: 'Corb', count: 2 },
        ],
      ],
      [deleted.participation.id, [], []],
    ]);
  });
});
