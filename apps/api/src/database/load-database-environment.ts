import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseEnvironment, validateEnvironment } from '../config/environment';

// `apps/api/.env`, resolved the same way from `src/database` and `dist/database`.
const ENV_FILE_PATH = join(__dirname, '..', '..', '.env');

/**
 * Database variables for the scripts that run outside Nest (TypeORM CLI, dev seed, db tests).
 * The `.env` file is optional: in deployed environments the variables come from the real environment.
 */
export function loadDatabaseEnvironment(): DatabaseEnvironment {
  if (existsSync(ENV_FILE_PATH)) {
    process.loadEnvFile(ENV_FILE_PATH);
  }
  return validateEnvironment(DatabaseEnvironment, process.env);
}
