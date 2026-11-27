import {
  DomainValidationError,
  EmailTakenError,
  InvalidReferenceError,
} from '../common/errors/domain-errors';
import type {
  AccountProvisioningService,
  StaffTotpEnrolment,
} from '../modules/accounts/account-provisioning.service';
import { TotpKeyMissingError } from '../modules/auth/totp/staff-totp';
import { CliUsageError, commandArguments, describeFailure } from './cli-runtime';
import { createStaffAccountCommand, parseCreateStaffArguments } from './create-staff-account';
import { promptNewPassword } from './password-prompt';
import { parseResetPasswordArguments, resetPasswordCommand } from './reset-password';
import { parseResetTotpArguments, resetTotpCommand } from './reset-totp';
import { NOT_A_TERMINAL_MESSAGE } from './totp-enrolment-output';

const EMAIL = 'ops@example.test';
const PASSWORD = 'harbour signal 2031 slowly';
const ENROLMENT: StaffTotpEnrolment = {
  otpauthUri:
    'otpauth://totp/E-Deep:ops%40example.test?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=E-Deep&algorithm=SHA1&digits=6&period=30',
};

const createStaffAccount = jest.fn<Promise<StaffTotpEnrolment>, [unknown]>();
const resetPassword = jest.fn<Promise<void>, [unknown]>();
const resetTotp = jest.fn<Promise<StaffTotpEnrolment>, [unknown]>();
const provisioning = {
  createStaffAccount,
  resetPassword,
  resetTotp,
} as unknown as AccountProvisioningService;

/** Standard output an interactive terminal, or redirected (pipe, file). */
const TERMINAL = () => true;
const REDIRECTED = () => false;

/** A reader answering `answers` in turn, recording the prompts. */
function reader(...answers: string[]) {
  const prompts: string[] = [];
  const read = (prompt: string) => {
    prompts.push(prompt);
    return Promise.resolve(answers.shift() ?? '');
  };
  return { read, prompts };
}

beforeEach(() => {
  jest.resetAllMocks();
  createStaffAccount.mockResolvedValue(ENROLMENT);
  resetPassword.mockResolvedValue(undefined);
  resetTotp.mockResolvedValue(ENROLMENT);
});

describe('commandArguments', () => {
  it('drops the node binary, the script and a leading `--`', () => {
    expect(commandArguments(['node', 'script.js', '--', 'support', EMAIL])).toEqual([
      'support',
      EMAIL,
    ]);
    expect(commandArguments(['node', 'script.js', 'support', EMAIL])).toEqual(['support', EMAIL]);
  });
});

describe('account:create-staff', () => {
  it.each([[['support', EMAIL]], [['admin', EMAIL]]])('accepts %p', (args) => {
    expect(parseCreateStaffArguments(args)).toEqual({ role: args[0], email: EMAIL });
  });

  it.each([[[]], [['diver', EMAIL]], [['root', EMAIL]], [['support']], [['support', EMAIL, 'x']]])(
    'refuses %p with the usage line, never echoing the arguments',
    (args) => {
      expect(() => parseCreateStaffArguments(args)).toThrow(
        new CliUsageError('Usage: account:create-staff <support|admin> <email>'),
      );
    },
  );

  it('reads the password twice, creates the account, then prints the enrolment URI once', async () => {
    const { read, prompts } = reader(PASSWORD, PASSWORD);

    const output = await createStaffAccountCommand(
      provisioning,
      ['support', EMAIL],
      read,
      TERMINAL,
    );

    expect(prompts).toEqual(['New password: ', 'Repeat the new password: ']);
    expect(createStaffAccount).toHaveBeenCalledWith({
      role: 'support',
      email: EMAIL,
      password: PASSWORD,
    });
    const lines = output.split('\n');
    expect(lines[0]).toBe('Staff account created.');
    expect(lines.filter((line) => line.includes('otpauth://'))).toEqual([ENROLMENT.otpauthUri]);
    // The only email printed is the URI label, URL-encoded.
    expect(output).not.toContain(EMAIL);
    expect(output).not.toContain(PASSWORD);
  });

  it('refuses two different passwords, creating nothing', async () => {
    await expect(
      createStaffAccountCommand(
        provisioning,
        ['support', EMAIL],
        reader(PASSWORD, 'other').read,
        TERMINAL,
      ),
    ).rejects.toThrow(new CliUsageError('The two passwords differ'));
    expect(createStaffAccount).not.toHaveBeenCalled();
  });

  it('refuses a redirected output before asking the password, creating nothing', async () => {
    const { read, prompts } = reader(PASSWORD, PASSWORD);

    const failure = createStaffAccountCommand(provisioning, ['support', EMAIL], read, REDIRECTED);

    await expect(failure).rejects.toThrow(new CliUsageError(NOT_A_TERMINAL_MESSAGE));
    expect(prompts).toEqual([]);
    expect(createStaffAccount).not.toHaveBeenCalled();
    expect(NOT_A_TERMINAL_MESSAGE).not.toMatch(/otpauth|ops@/);
  });
});

describe('account:reset-password', () => {
  it('takes exactly one email', () => {
    expect(parseResetPasswordArguments([EMAIL])).toEqual({ email: EMAIL });
    expect(() => parseResetPasswordArguments([])).toThrow(CliUsageError);
    expect(() => parseResetPasswordArguments([EMAIL, 'x'])).toThrow(CliUsageError);
  });

  it('resets with the password typed twice', async () => {
    await resetPasswordCommand(provisioning, [EMAIL], reader(PASSWORD, PASSWORD).read);

    expect(resetPassword).toHaveBeenCalledWith({ email: EMAIL, password: PASSWORD });
  });
});

describe('account:reset-totp', () => {
  it('takes exactly one email', () => {
    expect(parseResetTotpArguments([EMAIL])).toEqual({ email: EMAIL });
    expect(() => parseResetTotpArguments([])).toThrow(
      new CliUsageError('Usage: account:reset-totp <email>'),
    );
    expect(() => parseResetTotpArguments([''])).toThrow(CliUsageError);
    expect(() => parseResetTotpArguments([EMAIL, 'x'])).toThrow(CliUsageError);
  });

  it('replaces the secret, then prints the new enrolment URI once', async () => {
    const output = await resetTotpCommand(provisioning, [EMAIL], TERMINAL);

    expect(resetTotp).toHaveBeenCalledWith({ email: EMAIL });
    const lines = output.split('\n');
    expect(lines[0]).toBe('TOTP secret replaced; every session of the account ended.');
    expect(lines.filter((line) => line.includes('otpauth://'))).toEqual([ENROLMENT.otpauthUri]);
  });

  it('refuses bad arguments before any call', async () => {
    await expect(resetTotpCommand(provisioning, [], TERMINAL)).rejects.toThrow(CliUsageError);
    expect(resetTotp).not.toHaveBeenCalled();
  });

  it('refuses a redirected output before the reset', async () => {
    await expect(resetTotpCommand(provisioning, [EMAIL], REDIRECTED)).rejects.toThrow(
      new CliUsageError(NOT_A_TERMINAL_MESSAGE),
    );
    expect(resetTotp).not.toHaveBeenCalled();
  });
});

describe('promptNewPassword', () => {
  it('returns the password confirmed', async () => {
    await expect(promptNewPassword(reader(PASSWORD, PASSWORD).read)).resolves.toBe(PASSWORD);
  });
});

describe('describeFailure', () => {
  it.each([
    [new CliUsageError('Aborted'), 'Aborted'],
    [new EmailTakenError(), 'email-taken'],
    [new InvalidReferenceError(), 'invalid-reference'],
    [new TotpKeyMissingError(), 'TOTP_ENCRYPTION_KEY is required to enrol a staff account'],
    [
      new DomainValidationError({ password: ['too-short', 'compromised'] }),
      'validation-failed (password: too-short, compromised)',
    ],
  ])('%p → %s', (error, description) => {
    expect(describeFailure(error)).toBe(description);
  });

  it('gives the class name only of an unexpected error, never its message', () => {
    const description = describeFailure(new TypeError(`connect to ${EMAIL} failed`));

    expect(description).toBe('unexpected TypeError');
  });
});
