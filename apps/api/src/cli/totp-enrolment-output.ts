import type { StaffTotpEnrolment } from '../modules/accounts/account-provisioning.service';
import { CliUsageError } from './cli-runtime';

/** Whether the standard output is an interactive terminal. Injected by the tests. */
export type TerminalCheck = () => boolean;

/** The real check: `process.stdout.isTTY` (absent when piped or redirected to a file). */
export const stdoutIsTerminal: TerminalCheck = () => process.stdout.isTTY === true;

/** Static message: names no account, no secret. */
export const NOT_A_TERMINAL_MESSAGE =
  'The TOTP enrolment URI is printed to an interactive terminal only: run the command in a terminal, without redirecting its output';

/**
 * The `otpauth://` URI carries the TOTP secret in clear: it must reach the operator's eyes, never a
 * pipe, a file or a CI log. Checked before anything is written, so that a refusal changes nothing.
 *
 * @throws {CliUsageError} when the standard output is not an interactive terminal.
 */
export function assertEnrolmentTerminal(isTerminal: TerminalCheck): void {
  if (!isTerminal()) {
    throw new CliUsageError(NOT_A_TERMINAL_MESSAGE);
  }
}

/**
 * What a command that enrols a staff second factor prints: its outcome, then the `otpauth://` URI
 * to add to the authenticator app. Shown once: the secret is stored encrypted only.
 */
export function enrolmentOutput(outcome: string, { otpauthUri }: StaffTotpEnrolment): string {
  return [
    outcome,
    'Add this URI to the authenticator app of the account holder now (as a QR code or by hand).',
    'It is shown only once and carries the TOTP secret: do not store nor share it.',
    otpauthUri,
  ].join('\n');
}
