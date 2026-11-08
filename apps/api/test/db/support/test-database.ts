import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { DatabaseEnvironment, validateEnvironment } from '../../../src/config/environment';
import { buildDataSourceOptions } from '../../../src/database/database.options';
import { Buddy } from '../../../src/modules/buddies/buddy.entity';
import { CertificationLevel } from '../../../src/modules/certification-levels/certification-level.entity';
import { DiveSite } from '../../../src/modules/dive-sites/dive-site.entity';
import { Diver } from '../../../src/modules/divers/diver.entity';
import { DiveBuddy } from '../../../src/modules/dives/dive-buddy.entity';
import { DiveEvent } from '../../../src/modules/dives/dive-event.entity';
import { DiveParticipation } from '../../../src/modules/dives/dive-participation.entity';

const API_ROOT = join(__dirname, '..', '..', '..');

/** Compiled migrations (`pnpm test:db` builds first): the same files `migration:run` plays (D7). */
export const COMPILED_MIGRATIONS = join(API_ROOT, 'dist', 'database', 'migrations', '*.js');

export const ENTITIES = [
  CertificationLevel,
  Diver,
  DiveSite,
  Buddy,
  DiveEvent,
  DiveParticipation,
  DiveBuddy,
];

/** The dev database from `apps/api/.env` (the docker compose one). */
export function loadDevDatabaseEnvironment(): DatabaseEnvironment {
  const envFile = join(API_ROOT, '.env');
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  return validateEnvironment(DatabaseEnvironment, process.env);
}

/** Dedicated test database, next to the dev one: `<DATABASE_NAME>_test`, dropped and recreated. */
export function testDatabaseEnvironment(): DatabaseEnvironment {
  const environment = loadDevDatabaseEnvironment();
  const name = `${environment.DATABASE_NAME}_test`;
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error('Unsupported test database name');
  }
  return { ...environment, DATABASE_NAME: name };
}

export function createTestDataSource(): DataSource {
  return new DataSource({
    ...buildDataSourceOptions(testDatabaseEnvironment()),
    entities: ENTITIES,
    migrations: [COMPILED_MIGRATIONS],
  });
}

const SEEDED_LEVELS = "agency = 'FFESSM' AND code IN ('N1', 'N2', 'N3', 'N4')";

/** Empties every table and restores the seeded reference data. */
export async function resetDatabase(dataSource: DataSource): Promise<void> {
  await dataSource.query(
    'TRUNCATE dive_buddies, dive_participations, dive_events, buddies, dive_sites, divers',
  );
  await dataSource.query(`DELETE FROM certification_levels WHERE NOT (${SEEDED_LEVELS})`);
  await dataSource.query('UPDATE certification_levels SET is_active = true WHERE NOT is_active');
}
