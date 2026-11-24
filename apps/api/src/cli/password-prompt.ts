import { createInterface } from 'node:readline';
import { CliUsageError } from './cli-runtime';

/** Reads one secret line after showing `prompt`. Never echoes nor logs what is typed. */
export type PasswordReader = (prompt: string) => Promise<string>;

/** Code points kept from one typed line: beyond, the input is refused as `too-long` anyway. */
const MAX_TYPED_CODE_POINTS = 1024;

const ENTER = new Set(['\r', '\n']);
const CTRL_C = '\u0003';
const CTRL_D = '\u0004';
const BACKSPACE = new Set(['\u007f', '\b']);

/**
 * A new password typed twice on stdin. Two different inputs refuse the command: the operator
 * cannot see what was typed.
 *
 * @throws {CliUsageError} when the two inputs differ, or the input is aborted.
 */
export async function promptNewPassword(read: PasswordReader): Promise<string> {
  const password = await read('New password: ');
  const confirmation = await read('Repeat the new password: ');
  if (password !== confirmation) {
    throw new CliUsageError('The two passwords differ');
  }
  return password;
}

/**
 * The password reader of stdin. On a terminal, raw mode: nothing typed is echoed, Backspace
 * erases, Ctrl-C aborts. Otherwise (piped input), one line per read. The prompt goes to stderr, so
 * that stdout stays clean.
 */
export function stdinPasswordReader(): { readonly read: PasswordReader; close(): void } {
  if (process.stdin.isTTY) {
    return { read: readHiddenLine, close: () => process.stdin.pause() };
  }
  const lines = createInterface({ input: process.stdin, terminal: false })[Symbol.asyncIterator]();
  return {
    read: async (prompt) => {
      process.stderr.write(prompt);
      const line = await lines.next();
      process.stderr.write('\n');
      if (line.done === true) {
        throw new CliUsageError('No password on stdin');
      }
      return line.value;
    },
    close: () => {
      void lines.return?.();
    },
  };
}

function readHiddenLine(prompt: string): Promise<string> {
  const { stdin, stderr } = process;
  stderr.write(prompt);
  stdin.setRawMode(true);
  stdin.setEncoding('utf8');
  stdin.resume();
  return new Promise((resolve, reject) => {
    let typed: string[] = [];
    const finish = (outcome: () => void): void => {
      stdin.off('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
      stderr.write('\n');
      outcome();
    };
    const onData = (chunk: string): void => {
      for (const character of chunk) {
        if (ENTER.has(character) || (character === CTRL_D && typed.length > 0)) {
          const line = typed.join('');
          typed = [];
          finish(() => resolve(line));
          return;
        }
        if (character === CTRL_C || character === CTRL_D) {
          typed = [];
          finish(() => reject(new CliUsageError('Aborted')));
          return;
        }
        if (BACKSPACE.has(character)) {
          typed.pop();
        } else if (character >= ' ' && typed.length < MAX_TYPED_CODE_POINTS) {
          // Control characters (arrows, escape sequences) are not part of a password.
          typed.push(character);
        }
      }
    };
    stdin.on('data', onData);
  });
}
