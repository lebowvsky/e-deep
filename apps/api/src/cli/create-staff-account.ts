/**
 * `pnpm --filter api run account:create-staff <support|admin> <email>` (D39, D42): creates a staff
 * account of the back office, enrolled in TOTP. The password is typed twice on stdin, without
 * echo. Requires `TOTP_ENCRYPTION_KEY`. Prints the `otpauth://` enrolment URI **once**, for the
 * authenticator app of the account holder: it carries the TOTP secret and the email (label), on the
 * operator's terminal only, never in a log: refused, before anything is created, when stdout is not
 * an interactive terminal (piped, redirected). Never prints the password.
 */
import type { StaffRole } from '@e-deep/shared';
import { STAFF_ROLES } from '../modules/accounts/account-lists';
import type { AccountProvisioningService } from '../modules/accounts/account-provisioning.service';
import { CliUsageError, commandArguments, openCliContext, runCli } from './cli-runtime';
import { promptNewPassword, stdinPasswordReader, type PasswordReader } from './password-prompt';
import {
  assertEnrolmentTerminal,
  enrolmentOutput,
  stdoutIsTerminal,
  type TerminalCheck,
} from './totp-enrolment-output';

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
 * The command itself, without stdin nor database setup: the arguments, the terminal check
 * (`isTerminal`, before the password is even asked), then the password read by `read`. Shared by
 * the entry point and the tests (authorization matrix).
 */
export async function createStaffAccountCommand(
  provisioning: AccountProvisioningService,
  args: readonly string[],
  read: PasswordReader,
  isTerminal: TerminalCheck,
): Promise<string> {
  const { role, email } = parseCreateStaffArguments(args);
  assertEnrolmentTerminal(isTerminal);
  const password = await promptNewPassword(read);
  const enrolment = await provisioning.createStaffAccount({ role, email, password });
  return enrolmentOutput('Staff account created.', enrolment);
}

async function main(): Promise<string> {
  const args = commandArguments();
  // Checked before connecting: a typo or a redirected output costs no database round-trip.
  parseCreateStaffArguments(args);
  assertEnrolmentTerminal(stdoutIsTerminal);
  const context = await openCliContext({ enrolsTotp: true });
  const reader = stdinPasswordReader();
  try {
    return await createStaffAccountCommand(
      context.provisioning,
      args,
      reader.read,
      stdoutIsTerminal,
    );
  } finally {
    reader.close();
    await context.close();
  }
}

if (require.main === module) {
  runCli(main);
}
