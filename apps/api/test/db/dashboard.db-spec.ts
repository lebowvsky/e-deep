import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { CurrentDiverGuard } from '../../src/common/auth/current-diver.guard';
import type { AppConfigService } from '../../src/config/app-config.service';
import { DiveEvent } from '../../src/modules/dives/dive-event.entity';
import { DashboardService } from '../../src/modules/dashboard/dashboard.service';
import { Fixtures } from './support/fixtures';
import { createTestDataSource, resetDatabase } from './support/test-database';

const NOW = new Date('2026-11-08T12:00:00.000Z');

describe('dashboard', () => {
  let dataSource: DataSource;
  let fixtures: Fixtures;
  let dashboard: DashboardService;

  beforeAll(async () => {
    dataSource = await createTestDataSource().initialize();
    fixtures = new Fixtures(dataSource);
    dashboard = new DashboardService(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await resetDatabase(dataSource);
  });

  it('summarises the live dives of the diver only', async () => {
    const diver = await fixtures.diver({
      firstName: 'Marine',
      certificationLevelId: await fixtures.levelId('N2'),
    });
    const other = await fixtures.diver();
    const lucas = await fixtures.buddy(diver.id, { firstName: 'Lucas' });
    const thao = await fixtures.buddy(diver.id, { firstName: 'Thao' });
    const corse = await fixtures.site(diver.id, { name: 'Revellata', region: 'Corse' });
    const var_ = await fixtures.site(diver.id, { name: 'Gabinière', region: 'Var' });

    const dive = async (
      siteId: string,
      startedAt: string,
      maxDepthM: number,
      buddyIds: readonly string[],
      deleted = false,
    ) => {
      const event = await fixtures.event(diver.id, siteId, {
        startedAt: new Date(startedAt),
        utcOffsetMinutes: 60,
        ...(deleted ? { deletedAt: new Date() } : {}),
      });
      const participation = await fixtures.participation(event.id, diver.id, {
        maxDepthM,
        durationMin: 40,
      });
      for (const buddyId of buddyIds) {
        await fixtures.diveBuddy(diver.id, participation.id, buddyId);
      }
      return participation;
    };

    await dive(var_.id, '2026-09-01T08:00:00.000Z', 30, [lucas.id]);
    await dive(var_.id, '2026-10-01T08:00:00.000Z', 25, [lucas.id]);
    // Local month: 2026-11-01 00:30 at UTC+1 (still October in UTC).
    const latest = await dive(corse.id, '2026-10-31T23:30:00.000Z', 42, [lucas.id, thao.id]);
    // Deleted dive: ignored everywhere.
    await dive(corse.id, '2026-11-05T08:00:00.000Z', 60, [thao.id], true);
    await fixtures.dive(other.id);

    const result = await dashboard.getDashboard(diver.id, NOW);

    expect(result.user).toEqual({
      id: diver.id,
      firstName: 'Marine',
      lastName: diver.lastName,
      level: 'N2',
      federation: 'FFESSM',
      avatarUrl: null,
    });
    expect(result.stats).toMatchObject({
      totalDives: 3,
      totalUnderwaterMinutes: 120,
      maxDepthEver: { depthM: 42, siteName: 'Revellata', date: '2026-11-01T00:30:00+01:00' },
      sitesVisited: 2,
      divesThisMonth: 1,
      mainRegion: 'Var',
    });
    expect(result.stats.divesPerMonth).toHaveLength(12);
    expect(result.stats.divesPerMonth.slice(-3)).toEqual([
      { month: '2026-09', count: 1 },
      { month: '2026-10', count: 1 },
      { month: '2026-11', count: 1 },
    ]);
    expect(result.lastDive).toMatchObject({
      id: latest.id,
      date: '2026-11-01T00:30:00+01:00',
      utcOffsetMinutes: 60,
      site: { id: corse.id, name: 'Revellata', region: 'Corse' },
      depthMaxM: 42,
    });
    expect(result.lastDive?.buddies.map((buddy) => buddy.firstName).sort()).toEqual([
      'Lucas',
      'Thao',
    ]);
    expect(result.sites.map((site) => [site.name, site.diveCount, site.maxDepthM])).toEqual([
      ['Gabinière', 2, 30],
      ['Revellata', 1, 42],
    ]);
    expect(result.frequentBuddies.map((buddy) => [buddy.firstName, buddy.sharedDives])).toEqual([
      ['Lucas', 3],
      ['Thao', 1],
    ]);
  });

  it('returns an empty dashboard for a diver without dive', async () => {
    const diver = await fixtures.diver();
    const site = await fixtures.site(diver.id);
    const event = await fixtures.event(diver.id, site.id);
    await fixtures.participation(event.id, diver.id);
    await dataSource.manager.update(DiveEvent, { id: event.id }, { deletedAt: new Date() });

    const result = await dashboard.getDashboard(diver.id, NOW);

    expect(result.stats).toMatchObject({
      totalDives: 0,
      totalUnderwaterMinutes: 0,
      maxDepthEver: null,
      sitesVisited: 0,
      divesThisMonth: 0,
      mainRegion: null,
    });
    expect(result.stats.divesPerMonth.every((month) => month.count === 0)).toBe(true);
    expect(result).toMatchObject({ lastDive: null, sites: [], frequentBuddies: [] });
  });

  describe('CurrentDiverGuard (development stub)', () => {
    const request: { currentDiverId?: string } = {};
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const config = (stub: boolean) => ({ get: () => stub }) as unknown as AppConfigService;

    beforeEach(() => {
      delete request.currentDiverId;
    });

    it('acts for the first diver created when the stub is enabled', async () => {
      const first = await fixtures.diver();
      await fixtures.diver();

      await expect(
        new CurrentDiverGuard(config(true), dataSource).canActivate(context),
      ).resolves.toBe(true);
      expect(request.currentDiverId).toBe(first.id);
    });

    it('refuses every request when the stub is disabled', async () => {
      await fixtures.diver();
      await expect(
        new CurrentDiverGuard(config(false), dataSource).canActivate(context),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refuses when there is no diver', async () => {
      await expect(
        new CurrentDiverGuard(config(true), dataSource).canActivate(context),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
