/**
 * DataSource used by the TypeORM CLI only (`migration:*` scripts), never imported by the app.
 * The CLI loads the compiled file (`dist/database/data-source.js`): see package.json scripts.
 */
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database.options';
import { loadDatabaseEnvironment } from './load-database-environment';

export default new DataSource({
  ...buildDataSourceOptions(loadDatabaseEnvironment()),
  // The app relies on `autoLoadEntities`; the CLI needs them explicitly, hence the `*.entity.ts` naming rule.
  entities: [join(__dirname, '..', '**', '*.entity.js')],
});
