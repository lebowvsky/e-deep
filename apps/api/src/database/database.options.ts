import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import type { DatabaseEnvironment } from '../config/environment';

export type PostgresDataSourceOptions = Extract<DataSourceOptions, { type: 'postgres' }>;

/**
 * Single source of truth for the connection options used by both the Nest app (`DatabaseModule`)
 * and the TypeORM CLI (`data-source.ts`), so they can never drift apart.
 */
export function buildDataSourceOptions(
  environment: DatabaseEnvironment,
): PostgresDataSourceOptions {
  return {
    type: 'postgres',
    host: environment.DATABASE_HOST,
    port: environment.DATABASE_PORT,
    username: environment.DATABASE_USER,
    password: environment.DATABASE_PASSWORD,
    database: environment.DATABASE_NAME,
    // The schema only ever changes through migrations, in every environment.
    synchronize: false,
    migrationsRun: false,
    // Both the app and the CLI run compiled code from `dist`.
    migrations: [join(__dirname, 'migrations', '*.js')],
    // GDPR: TypeORM logs would print SQL queries with their parameters (potential health data).
    logging: false,
  };
}
