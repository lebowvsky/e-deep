/**
 * DataSource used by the TypeORM CLI only (`migration:*` scripts), never imported by the app.
 * The CLI loads the compiled file (`dist/database/data-source.js`): see package.json scripts.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { DatabaseEnvironment, validateEnvironment } from '../config/environment';
import { buildDataSourceOptions } from './database.options';

// `apps/api/.env`, resolved the same way from `src/database` and `dist/database`.
// Optional: in deployed environments the variables come from the real environment.
const ENV_FILE_PATH = join(__dirname, '..', '..', '.env');
if (existsSync(ENV_FILE_PATH)) {
  process.loadEnvFile(ENV_FILE_PATH);
}

const environment = validateEnvironment(DatabaseEnvironment, process.env);

export default new DataSource({
  ...buildDataSourceOptions(environment),
  // The app relies on `autoLoadEntities`; the CLI needs them explicitly, hence the `*.entity.ts` naming rule.
  entities: [join(__dirname, '..', '**', '*.entity.js')],
});
