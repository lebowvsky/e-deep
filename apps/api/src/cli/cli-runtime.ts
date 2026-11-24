import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { DomainError, DomainValidationError } from '../common/errors/domain-errors';
import { errorClassName } from '../common/logging/error-class-name';
import { systemClock } from '../common/time/clock';
import { EnvironmentValidationError } from '../config/environment';
import { buildDataSourceOptions } from '../database/database.options';
import { loadDatabaseEnvironment } from '../database/load-database-environment';
import { AccountProvisioningService } from '../modules/accounts/account-provisioning.service';
import { AuthEventsService } from '../modules/auth/auth-events.service';
import { loadCompromisedPasswords } from '../modules/auth/password/compromised-passwords';
import { PasswordHasher } from '../modules/auth/password/password-hasher';
import { PasswordPolicy } from '../modules/auth/password/password-policy';
import { SessionService } from '../modules/auth/session.service';

/** A wrong use of a command (arguments, aborted input). Its message is static: safe to print. */
export class CliUsageError extends Error {
  override readonly name = 'CliUsageError';
}

/** What an operator command needs, outside Nest (like the dev seed): the database and its services. */
export interface CliContext {
  readonly provisioning: AccountProvisioningService;
  close(): Promise<void>;
}

/**
 * Connects to the database of `apps/api/.env` (or of the real environment) and builds the
 * provisioning service with the same hasher and policy as the API (D35).
 */
export async function openCliContext(): Promise<CliContext> {
  const dataSource = new DataSource({
    ...buildDataSourceOptions(loadDatabaseEnvironment()),
    // Compiled code (`dist/cli`): the entities of `dist/**`.
    entities: [join(__dirname, '..', '**', '*.entity.js')],
  });
  await dataSource.initialize();
  try {
    if (await dataSource.showMigrations()) {
      throw new CliUsageError('Pending migrations: run `pnpm migration:run` first');
    }
    const provisioning = new AccountProvisioningService(
      dataSource,
      await PasswordHasher.create(),
      new PasswordPolicy(await loadCompromisedPasswords()),
      new SessionService(dataSource, systemClock),
      new AuthEventsService(dataSource),
    );
    return { provisioning, close: () => dataSource.destroy() };
  } catch (error) {
    await dataSource.destroy();
    throw error;
  }
}

/**
 * Runs a command and reports its outcome on one line: a generic success message, or the error
 * codes. Never an email, a password nor a driver message (GDPR, ARCHITECTURE §9).
 */
export function runCli(command: () => Promise<string>): void {
  command().then(
    (success) => {
      process.stdout.write(`${success}\n`);
    },
    (error: unknown) => {
      process.stderr.write(`Refused: ${describeFailure(error)}\n`);
      process.exitCode = 1;
    },
  );
}

/** Command arguments after the script name; a leading `--` (passed through by pnpm) is dropped. */
export function commandArguments(argv: readonly string[] = process.argv): string[] {
  const args = argv.slice(2);
  return args[0] === '--' ? args.slice(1) : args;
}

export function describeFailure(error: unknown): string {
  // Static messages, or variable names only (never their values).
  if (error instanceof CliUsageError || error instanceof EnvironmentValidationError) {
    return error.message;
  }
  if (error instanceof DomainValidationError) {
    const fields = Object.entries(error.fieldErrors).map(
      ([field, codes]) => `${field}: ${codes.join(', ')}`,
    );
    return `validation-failed (${fields.join('; ')})`;
  }
  if (error instanceof DomainError) {
    return error.code;
  }
  return `unexpected ${errorClassName(error)}`;
}
