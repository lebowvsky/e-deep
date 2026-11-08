/**
 * Development seed: `pnpm db:seed` (builds, then runs `dist/database/seeds/dev-seed.js`).
 *
 * Empties the dive log tables (the certification levels reference data is kept) and fills them with
 * fictitious divers, sites, buddies and dives. Goes through the services, so every invariant (owner,
 * level snapshot, dive team, triggers) applies. Re-runnable: same final state every time.
 *
 * Refuses any database that is not local. GDPR: only counts and error class names are logged.
 */
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { DomainError } from '../../common/errors/domain-errors';
import { errorClassName } from '../../common/logging/error-class-name';
import { DEFAULT_PURGE_HORIZON_DAYS, type SyncSettings } from '../../common/sync/sync-settings';
import { BuddiesService } from '../../modules/buddies/buddies.service';
import { CertificationLevel } from '../../modules/certification-levels/certification-level.entity';
import { DiveSitesService } from '../../modules/dive-sites/dive-sites.service';
import { DiversService } from '../../modules/divers/divers.service';
import { DivesService } from '../../modules/dives/dives.service';
import { buildDataSourceOptions } from '../database.options';
import { loadDatabaseEnvironment } from '../load-database-environment';
import { SEED_DIVERS, type LevelCode, type SeedDive, type SeedDiver } from './dev-seed.data';

const LOCAL_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '::1']);
const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;

const logger = new Logger('DevSeed');

class SeedRefusedError extends Error {
  override readonly name = 'SeedRefusedError';
}

interface SeedReport {
  divers: number;
  sites: number;
  buddies: number;
  dives: number;
  deletedDives: number;
}

class DevSeeder {
  private readonly settings: SyncSettings = { purgeHorizonDays: DEFAULT_PURGE_HORIZON_DAYS };
  private readonly divers: DiversService;
  private readonly sites: DiveSitesService;
  private readonly buddies: BuddiesService;
  private readonly dives: DivesService;
  private readonly diverIds = new Map<string, string>();
  private readonly levelIds = new Map<LevelCode, string>();

  constructor(private readonly dataSource: DataSource) {
    this.divers = new DiversService(dataSource);
    this.sites = new DiveSitesService(dataSource, this.settings);
    this.buddies = new BuddiesService(dataSource, this.settings);
    this.dives = new DivesService(dataSource, this.settings);
  }

  async run(): Promise<SeedReport> {
    const report: SeedReport = { divers: 0, sites: 0, buddies: 0, dives: 0, deletedDives: 0 };
    await this.reset();
    await this.loadLevels();

    // Accounts first: buddies of one diver may be linked to another diver's account.
    for (const diver of SEED_DIVERS) {
      const created = await this.divers.create({
        firstName: diver.firstName,
        lastName: diver.lastName,
        certificationLevelId: this.levelId(diver.levelCode),
        avatarUrl: null,
      });
      this.diverIds.set(diver.key, created.id);
      report.divers += 1;
    }

    for (const diver of SEED_DIVERS) {
      await this.seedLogbook(diver, report);
    }
    return report;
  }

  /** Empties the dive log; `certification_levels` (migration seed) is kept. */
  private async reset(): Promise<void> {
    await this.dataSource.query(
      'TRUNCATE dive_buddies, dive_participations, dive_events, buddies, dive_sites, divers',
    );
  }

  private async loadLevels(): Promise<void> {
    const levels = await this.dataSource.manager.findBy(CertificationLevel, { agency: 'FFESSM' });
    for (const level of levels) {
      this.levelIds.set(level.code as LevelCode, level.id);
    }
  }

  private async seedLogbook(diver: SeedDiver, report: SeedReport): Promise<void> {
    const diverId = this.required(this.diverIds, diver.key);
    const lastPulledAt = new Date();
    const siteIds = new Map<string, string>();
    const buddyIds = new Map<string, string>();

    for (const site of diver.sites) {
      const id = await this.newId();
      await this.sites.upsert(
        diverId,
        {
          id,
          name: site.name,
          region: site.region,
          latitude: site.latitude,
          longitude: site.longitude,
          baseUpdatedAt: null,
          deletedAt: null,
        },
        lastPulledAt,
      );
      siteIds.set(site.key, id);
      report.sites += 1;
    }

    for (const buddy of diver.buddies) {
      const id = await this.newId();
      await this.buddies.upsert(
        diverId,
        {
          id,
          firstName: buddy.firstName,
          lastName: buddy.lastName,
          linkedDiverId:
            buddy.linkedDiverKey === undefined
              ? null
              : this.required(this.diverIds, buddy.linkedDiverKey),
          baseUpdatedAt: null,
          deletedAt: null,
        },
        lastPulledAt,
      );
      buddyIds.set(buddy.key, id);
      report.buddies += 1;
    }

    // Oldest first, so `updated_at` (the sync cursor) follows the logbook order.
    const dives = [...diver.dives].sort((left, right) => right.daysAgo - left.daysAgo);
    for (const dive of dives) {
      const eventId = await this.newId();
      await this.dives.upsertDive(
        diverId,
        {
          event: {
            id: eventId,
            siteId: this.required(siteIds, dive.siteKey),
            ...startedAt(dive),
            baseUpdatedAt: null,
            deletedAt: null,
          },
          participation: {
            id: await this.newId(),
            ...(dive.levelCode === undefined
              ? {}
              : { certificationLevelId: this.levelId(dive.levelCode) }),
            maxDepthM: dive.maxDepthM,
            durationMin: dive.durationMin,
            waterTemperatureC: dive.waterTemperatureC,
            visibilityM: dive.visibilityM,
            gasMix: dive.gasMix,
            hasDecompression: dive.hasDecompression,
            stopsOk: dive.stopsOk,
            notes: dive.notes,
            baseUpdatedAt: null,
            deletedAt: null,
          },
          buddyIds: dive.buddyKeys.map((key) => this.required(buddyIds, key)),
        },
        lastPulledAt,
      );
      report.dives += 1;
      if (dive.deleted === true) {
        await this.dives.deleteDive(diverId, eventId);
        report.deletedDives += 1;
      }
    }
  }

  /** UUIDv7, as a client would generate it (PostgreSQL 18 native function). */
  private async newId(): Promise<string> {
    const rows: unknown = await this.dataSource.query('SELECT uuidv7() AS id');
    const id: unknown = Array.isArray(rows)
      ? (rows[0] as { id?: unknown } | undefined)?.id
      : undefined;
    if (typeof id !== 'string') {
      throw new Error('uuidv7() returned no id');
    }
    return id;
  }

  private levelId(code: LevelCode): string {
    return this.required(this.levelIds, code);
  }

  private required<K, V>(map: ReadonlyMap<K, V>, key: K): V {
    const value = map.get(key);
    if (value === undefined) {
      throw new Error('Inconsistent seed data');
    }
    return value;
  }
}

/** Instant and offset of a dive held `daysAgo` days ago at `localHour`, French local time. */
function startedAt(dive: SeedDive): { startedAt: Date; utcOffsetMinutes: number } {
  const today = new Date();
  const day =
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) -
    dive.daysAgo * MS_PER_DAY;
  const month = new Date(day).getUTCMonth();
  // Approximation of the French summer time (end of March to end of October).
  const utcOffsetMinutes = month >= 3 && month <= 9 ? 120 : 60;
  return {
    startedAt: new Date(day + (dive.localHour * 60 - utcOffsetMinutes) * MS_PER_MINUTE),
    utcOffsetMinutes,
  };
}

/** Error detail safe to log: class name, generic domain message or violated constraint name. */
function describeError(error: unknown): string {
  if (error instanceof DomainError || error instanceof SeedRefusedError) {
    return `${errorClassName(error)}: ${error.message}`;
  }
  if (error instanceof QueryFailedError) {
    const driverError: unknown = error.driverError;
    const constraint =
      typeof driverError === 'object' && driverError !== null && 'constraint' in driverError
        ? String(driverError.constraint)
        : 'unknown constraint';
    return `${errorClassName(error)} (${constraint})`;
  }
  return errorClassName(error);
}

async function main(): Promise<void> {
  const environment = loadDatabaseEnvironment();
  if (!LOCAL_HOSTS.has(environment.DATABASE_HOST)) {
    throw new SeedRefusedError('The dev seed only runs against a local database');
  }

  const dataSource = new DataSource({
    ...buildDataSourceOptions(environment),
    entities: [join(__dirname, '..', '..', '**', '*.entity.js')],
  });
  await dataSource.initialize();
  try {
    if (await dataSource.showMigrations()) {
      throw new SeedRefusedError('Pending migrations: run `pnpm migration:run` first');
    }
    const report = await new DevSeeder(dataSource).run();
    logger.log(
      `Seeded ${String(report.divers)} divers, ${String(report.sites)} sites, ${String(report.buddies)} buddies, ` +
        `${String(report.dives)} dives (${String(report.deletedDives)} deleted)`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  logger.error(`Seed failed (${describeError(error)})`);
  process.exitCode = 1;
});
