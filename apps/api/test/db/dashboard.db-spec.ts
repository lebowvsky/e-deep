import type { DataSource } from 'typeorm';
import { DevAuthStub } from '../../src/common/auth/dev-auth-stub';
import { asDiverId } from '../../src/common/auth/diver-id';
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

    const result = await dashboard.getDashboard(asDiverId(diver.id), NOW);

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

    const result = await dashboard.getDashboard(asDiverId(diver.id), NOW);

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

  it('refuses an incomplete profile (invariant, until the onboarding guard of lot 4)', async () => {
    const diver = await fixtures.incompleteDiver();

    await expect(dashboard.getDashboard(asDiverId(diver.id), NOW)).rejects.toThrow(
      'Incomplete diver profile: no certification level',
    );
  });

  it('answers a null last name: it is optional at /welcome (D36)', async () => {
    const diver = await fixtures.diver({ lastName: null });

    const result = await dashboard.getDashboard(asDiverId(diver.id), NOW);

    expect(result.user.lastName).toBeNull();
  });

  describe('DevAuthStub (development fallback of the SessionGuard)', () => {
    let stub: DevAuthStub;

    beforeAll(() => {
      stub = new DevAuthStub(dataSource);
    });

    it('finds the account of the first diver created', async () => {
      const first = await fixtures.diver();
      const second = await fixtures.diver();
      await fixtures.account(second.id, { email: 'second@example.test' });
      const account = await fixtures.account(first.id, { email: 'first@example.test' });

      await expect(stub.firstDiverAccount()).resolves.toEqual({
        accountId: account.id,
        diverId: first.id,
      });
    });

    it('finds nothing when the first diver has no account', async () => {
      await fixtures.diver();
      const second = await fixtures.diver();
      await fixtures.account(second.id);

      await expect(stub.firstDiverAccount()).resolves.toBeNull();
    });

    it('finds nothing when there is no diver', async () => {
      await expect(stub.firstDiverAccount()).resolves.toBeNull();
    });
  });
});
