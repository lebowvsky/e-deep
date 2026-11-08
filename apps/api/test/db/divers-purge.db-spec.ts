import type { DataSource } from 'typeorm';
import { InactiveCertificationLevelError } from '../../src/common/errors/domain-errors';
import { Buddy } from '../../src/modules/buddies/buddy.entity';
import { CertificationLevel } from '../../src/modules/certification-levels/certification-level.entity';
import { CertificationLevelsService } from '../../src/modules/certification-levels/certification-levels.service';
import { DiveSite } from '../../src/modules/dive-sites/dive-site.entity';
import { Diver } from '../../src/modules/divers/diver.entity';
import { DiversService } from '../../src/modules/divers/divers.service';
import { DiveBuddy } from '../../src/modules/dives/dive-buddy.entity';
import { DiveEvent } from '../../src/modules/dives/dive-event.entity';
import { DiveParticipation } from '../../src/modules/dives/dive-participation.entity';
import { PurgeService } from '../../src/modules/dives/purge.service';
import { Fixtures, SYNC_SETTINGS_90_DAYS } from './support/fixtures';
import { createTestDataSource, resetDatabase } from './support/test-database';

describe('DiversService, CertificationLevelsService and PurgeService', () => {
  let dataSource: DataSource;
  let fixtures: Fixtures;
  let divers: DiversService;
  let purge: PurgeService;

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    fixtures = new Fixtures(dataSource);
    divers = new DiversService(dataSource);
    purge = new PurgeService(dataSource, SYNC_SETTINGS_90_DAYS);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  describe('current level', () => {
    it('creates a diver with an active level, generating its id', async () => {
      const diver = await divers.create({
        firstName: 'Lou',
        lastName: 'Petit',
        certificationLevelId: await fixtures.levelId('N2'),
        avatarUrl: null,
      });
      expect(diver.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    });

    it('refuses a deactivated level as the current level', async () => {
      const retired = await fixtures.addLevel({ isActive: false });
      const diver = await fixtures.diver();

      await expect(divers.changeCertificationLevel(diver.id, retired.id)).rejects.toThrow(
        InactiveCertificationLevelError,
      );
      await expect(
        divers.create({
          firstName: 'Lou',
          lastName: 'Petit',
          certificationLevelId: retired.id,
          avatarUrl: null,
        }),
      ).rejects.toThrow(InactiveCertificationLevelError);
    });
  });

  it('lists the whole reference data', async () => {
    await fixtures.addLevel({ agency: 'CMAS', code: '1*', isActive: false });
    const levels = await new CertificationLevelsService(dataSource).findAll();
    expect(levels.map((level) => `${level.agency} ${level.code}`)).toEqual([
      'CMAS 1*',
      'FFESSM N1',
      'FFESSM N2',
      'FFESSM N3',
      'FFESSM N4',
    ]);
  });

  it('deleteAccount erases everything of the diver and unlinks the contacts of others', async () => {
    const leaving = await fixtures.diver();
    const other = await fixtures.diver();
    const buddy = await fixtures.buddy(leaving.id);
    await fixtures.dive(leaving.id, [buddy.id]);
    const deletedDive = await fixtures.dive(leaving.id, [buddy.id]);
    await dataSource.manager.update(
      DiveEvent,
      { id: deletedDive.event.id },
      { deletedAt: new Date() },
    );
    const othersContact = await fixtures.buddy(other.id, { linkedDiverId: leaving.id });
    const othersDive = await fixtures.dive(other.id);

    await divers.deleteAccount(leaving.id);

    const manager = dataSource.manager;
    expect(await manager.existsBy(Diver, { id: leaving.id })).toBe(false);
    expect(await manager.countBy(DiveSite, { ownerId: leaving.id })).toBe(0);
    expect(await manager.countBy(Buddy, { ownerId: leaving.id })).toBe(0);
    expect(await manager.countBy(DiveEvent, { creatorId: leaving.id })).toBe(0);
    expect(await manager.countBy(DiveParticipation, { diverId: leaving.id })).toBe(0);
    expect(await manager.countBy(DiveBuddy, { ownerId: leaving.id })).toBe(0);
    expect(await manager.findOneByOrFail(Buddy, { id: othersContact.id })).toMatchObject({
      linkedDiverId: null,
    });
    expect(await manager.existsBy(DiveParticipation, { id: othersDive.participation.id })).toBe(
      true,
    );
  });

  describe('purge', () => {
    it('cascade + trigger, case 2: purges old tombstones in order, dive teams included', async () => {
      const diver = await fixtures.diver();
      const buddy = await fixtures.buddy(diver.id);
      const { site, event, participation } = await fixtures.dive(diver.id, [buddy.id]);
      for (const [table, id] of [
        ['dive_participations', participation.id],
        ['dive_events', event.id],
        ['buddies', buddy.id],
        ['dive_sites', site.id],
      ] as const) {
        await fixtures.ageTombstone(table, id, 91);
      }

      const report = await purge.purge();

      expect(report).toEqual({ participations: 1, events: 1, buddies: 1, sites: 1 });
      expect(await dataSource.manager.count(DiveBuddy)).toBe(0);
      expect(await dataSource.manager.count(DiveSite)).toBe(0);
    });

    it('keeps an event with a remaining participation and a site with a remaining event', async () => {
      const diver = await fixtures.diver();
      const { site, event } = await fixtures.dive(diver.id);
      await fixtures.ageTombstone('dive_events', event.id, 91);
      await fixtures.ageTombstone('dive_sites', site.id, 91);

      const report = await purge.purge();

      expect(report).toEqual({ participations: 0, events: 0, buddies: 0, sites: 0 });
      expect(await dataSource.manager.existsBy(DiveEvent, { id: event.id })).toBe(true);
      expect(await dataSource.manager.existsBy(DiveSite, { id: site.id })).toBe(true);
    });

    it('keeps a site referenced by a tombstoned event that is not purgeable yet', async () => {
      const diver = await fixtures.diver();
      const { site, event, participation } = await fixtures.dive(diver.id);
      await fixtures.ageTombstone('dive_participations', participation.id, 91);
      await fixtures.ageTombstone('dive_events', event.id, 10);
      await fixtures.ageTombstone('dive_sites', site.id, 91);

      const report = await purge.purge();

      expect(report).toEqual({ participations: 1, events: 0, buddies: 0, sites: 0 });
      expect(await dataSource.manager.existsBy(DiveSite, { id: site.id })).toBe(true);
    });

    it('keeps recent tombstones and never purges certification levels', async () => {
      const diver = await fixtures.diver();
      const retired = await fixtures.addLevel({ isActive: false });
      const site = await fixtures.site(diver.id);
      await fixtures.ageTombstone('dive_sites', site.id, 30);

      await purge.purge();

      expect(await dataSource.manager.existsBy(DiveSite, { id: site.id })).toBe(true);
      expect(await dataSource.manager.existsBy(CertificationLevel, { id: retired.id })).toBe(true);
      expect(await dataSource.manager.count(CertificationLevel)).toBe(5);
    });
  });
});
