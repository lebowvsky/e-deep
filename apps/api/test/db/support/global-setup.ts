import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../../src/database/database.options';
import {
  createTestDataSource,
  loadDevDatabaseEnvironment,
  testDatabaseEnvironment,
} from './test-database';

/**
 * Recreates the dedicated test database on the docker compose PostgreSQL, then plays the compiled
 * migrations on it. Default export imposed by Jest (`globalSetup`).
 */
export default async function globalSetup(): Promise<void> {
  const admin = new DataSource({
    ...buildDataSourceOptions(loadDevDatabaseEnvironment()),
    migrations: [],
  });
  const testDatabase = testDatabaseEnvironment().DATABASE_NAME;

  await admin.initialize();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${testDatabase}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${testDatabase}"`);
  } finally {
    await admin.destroy();
  }

  const dataSource = createTestDataSource();
  await dataSource.initialize();
  try {
    await dataSource.runMigrations({ transaction: 'each' });
  } finally {
    await dataSource.destroy();
  }
}
