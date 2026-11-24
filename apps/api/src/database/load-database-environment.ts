import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ClassConstructor } from 'class-transformer';
import { DatabaseEnvironment, validateEnvironment } from '../config/environment';

// `apps/api/.env`, resolved the same way from `src/database` and `dist/database`.
const ENV_FILE_PATH = join(__dirname, '..', '..', '.env');

/**
 * Variables of a script that runs outside Nest, validated against `schema`: the TypeORM CLI, the
 * db tests and the operator commands use `DatabaseEnvironment` (`loadDatabaseEnvironment`), the
 * dev seed its own `SeedEnvironment`, so that a variable only the seed needs is required by it
 * alone. The `.env` file is optional: in deployed environments the variables come from the real
 * environment.
 *
 * @throws {EnvironmentValidationError} naming the invalid variables, never their values.
 */
export function loadScriptEnvironment<T extends DatabaseEnvironment>(
  schema: ClassConstructor<T>,
): T {
  if (existsSync(ENV_FILE_PATH)) {
    process.loadEnvFile(ENV_FILE_PATH);
  }
  return validateEnvironment(schema, process.env);
}

/** Database variables (TypeORM CLI, db tests, operator commands). */
export function loadDatabaseEnvironment(): DatabaseEnvironment {
  return loadScriptEnvironment(DatabaseEnvironment);
}
