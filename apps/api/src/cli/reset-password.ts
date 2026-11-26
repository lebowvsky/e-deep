/**
 * `pnpm --filter api run account:reset-password <email>` (D39: no email in V1, the support resets
 * the password): sets the new password chosen by the account holder, typed twice on stdin without
 * echo, then ends every session of the account. Prints a generic line, never the email nor the
 * password.
 */
import type { AccountProvisioningService } from '../modules/accounts/account-provisioning.service';
import { CliUsageError, commandArguments, openCliContext, runCli } from './cli-runtime';
import { promptNewPassword, stdinPasswordReader, type PasswordReader } from './password-prompt';

const USAGE = 'Usage: account:reset-password <email>';

/** @throws {CliUsageError} for anything but a single email. */
export function parseResetPasswordArguments(args: readonly string[]): { readonly email: string } {
  const [email, ...extra] = args;
  if (email === undefined || email === '' || extra.length > 0) {
    throw new CliUsageError(USAGE);
  }
  return { email };
}

/** The command itself, without stdin nor database setup (see `createStaffAccountCommand`). */
export async function resetPasswordCommand(
  provisioning: AccountProvisioningService,
  args: readonly string[],
  read: PasswordReader,
): Promise<string> {
  const { email } = parseResetPasswordArguments(args);
  const password = await promptNewPassword(read);
  await provisioning.resetPassword({ email, password });
  return 'Password reset; every session of the account ended.';
}

async function main(): Promise<string> {
  const args = commandArguments();
  parseResetPasswordArguments(args);
  const context = await openCliContext({ enrolsTotp: false });
  const reader = stdinPasswordReader();
  try {
    return await resetPasswordCommand(context.provisioning, args, reader.read);
  } finally {
    reader.close();
    await context.close();
  }
}

if (require.main === module) {
  runCli(main);
}
