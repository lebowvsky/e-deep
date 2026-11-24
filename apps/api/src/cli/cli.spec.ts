import {
  DomainValidationError,
  EmailTakenError,
  InvalidReferenceError,
} from '../common/errors/domain-errors';
import type { AccountProvisioningService } from '../modules/accounts/account-provisioning.service';
import { CliUsageError, commandArguments, describeFailure } from './cli-runtime';
import { createStaffAccountCommand, parseCreateStaffArguments } from './create-staff-account';
import { promptNewPassword } from './password-prompt';
import { parseResetPasswordArguments, resetPasswordCommand } from './reset-password';

const EMAIL = 'ops@example.test';
const PASSWORD = 'harbour signal 2031 slowly';

const createStaffAccount = jest.fn<Promise<void>, [unknown]>();
const resetPassword = jest.fn<Promise<void>, [unknown]>();
const provisioning = { createStaffAccount, resetPassword } as unknown as AccountProvisioningService;

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
  createStaffAccount.mockResolvedValue(undefined);
  resetPassword.mockResolvedValue(undefined);
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

  it('reads the password twice, then creates the account; generic output', async () => {
    const { read, prompts } = reader(PASSWORD, PASSWORD);

    const output = await createStaffAccountCommand(provisioning, ['support', EMAIL], read);

    expect(prompts).toEqual(['New password: ', 'Repeat the new password: ']);
    expect(createStaffAccount).toHaveBeenCalledWith({
      role: 'support',
      email: EMAIL,
      password: PASSWORD,
    });
    expect(output).not.toContain(EMAIL);
    expect(output).not.toContain(PASSWORD);
  });

  it('refuses two different passwords, creating nothing', async () => {
    await expect(
      createStaffAccountCommand(provisioning, ['support', EMAIL], reader(PASSWORD, 'other').read),
    ).rejects.toThrow(new CliUsageError('The two passwords differ'));
    expect(createStaffAccount).not.toHaveBeenCalled();
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
