/**
 * `pnpm --filter api run account:reset-totp <email>` (D42): replaces the TOTP secret of a staff
 * account (lost or compromised authenticator), ends every session of the account and records a
 * `totp_reset` auth event. Requires `TOTP_ENCRYPTION_KEY`. A diver account and an unknown email
 * get the same `invalid-reference`. Prints the new `otpauth://` URI **once** (secret and email in
 * it), on the operator's terminal only, never in a log: refused, before the reset, when stdout is
 * not an interactive terminal (piped, redirected).
 */
import type { AccountProvisioningService } from '../modules/accounts/account-provisioning.service';
import { CliUsageError, commandArguments, openCliContext, runCli } from './cli-runtime';
import {
  assertEnrolmentTerminal,
  enrolmentOutput,
  stdoutIsTerminal,
  type TerminalCheck,
} from './totp-enrolment-output';

const USAGE = 'Usage: account:reset-totp <email>';

/** @throws {CliUsageError} for anything but a single email. */
export function parseResetTotpArguments(args: readonly string[]): { readonly email: string } {
  const [email, ...extra] = args;
  if (email === undefined || email === '' || extra.length > 0) {
    throw new CliUsageError(USAGE);
  }
  return { email };
}

/**
 * The command itself, without the database setup (see `createStaffAccountCommand`): the terminal
 * check (`isTerminal`) comes before the reset.
 */
export async function resetTotpCommand(
  provisioning: AccountProvisioningService,
  args: readonly string[],
  isTerminal: TerminalCheck,
): Promise<string> {
  const { email } = parseResetTotpArguments(args);
  assertEnrolmentTerminal(isTerminal);
  const enrolment = await provisioning.resetTotp({ email });
  return enrolmentOutput('TOTP secret replaced; every session of the account ended.', enrolment);
}

async function main(): Promise<string> {
  const args = commandArguments();
  parseResetTotpArguments(args);
  assertEnrolmentTerminal(stdoutIsTerminal);
  const context = await openCliContext({ enrolsTotp: true });
  try {
    return await resetTotpCommand(context.provisioning, args, stdoutIsTerminal);
  } finally {
    await context.close();
  }
}

if (require.main === module) {
  runCli(main);
}
