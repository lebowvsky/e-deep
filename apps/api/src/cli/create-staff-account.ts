/**
 * `pnpm --filter api run account:create-staff <support|admin> <email>` (D39, D42): creates a staff
 * account of the back office. The password is typed twice on stdin, without echo. Prints a generic
 * line, never the email nor the password. The TOTP enrolment comes with lot 7.
 */
import type { StaffRole } from '@e-deep/shared';
import { STAFF_ROLES } from '../modules/accounts/account-lists';
import type { AccountProvisioningService } from '../modules/accounts/account-provisioning.service';
import { CliUsageError, commandArguments, openCliContext, runCli } from './cli-runtime';
import { promptNewPassword, stdinPasswordReader, type PasswordReader } from './password-prompt';

const USAGE = 'Usage: account:create-staff <support|admin> <email>';

export interface CreateStaffArguments {
  readonly role: StaffRole;
  readonly email: string;
}

/** @throws {CliUsageError} for anything but a staff role and an email. */
export function parseCreateStaffArguments(args: readonly string[]): CreateStaffArguments {
  const [roleArgument, email, ...extra] = args;
  const role = STAFF_ROLES.find((staffRole) => staffRole === roleArgument);
  if (role === undefined || email === undefined || email === '' || extra.length > 0) {
    throw new CliUsageError(USAGE);
  }
  return { role, email };
}

/**
 * The command itself, without stdin nor database setup: the arguments, then the password read by
 * `read`. Shared by the entry point and the tests (authorization matrix).
 */
export async function createStaffAccountCommand(
  provisioning: AccountProvisioningService,
  args: readonly string[],
  read: PasswordReader,
): Promise<string> {
  const { role, email } = parseCreateStaffArguments(args);
  const password = await promptNewPassword(read);
  await provisioning.createStaffAccount({ role, email, password });
  return 'Staff account created.';
}

async function main(): Promise<string> {
  const args = commandArguments();
  // Checked before connecting: a typo costs no database round-trip.
  parseCreateStaffArguments(args);
  const context = await openCliContext();
  const reader = stdinPasswordReader();
  try {
    return await createStaffAccountCommand(context.provisioning, args, reader.read);
  } finally {
    reader.close();
    await context.close();
  }
}

if (require.main === module) {
  runCli(main);
}
