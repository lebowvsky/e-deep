import { startTransition, useActionState, useRef } from 'react';
import { toSubmitFailure, type SubmitFailure, type SubmittedValues } from '../lib/authErrors';
import { useCountdown } from './useCountdown';

/** The last submission's outcome; `count` tells two identical failures apart (re-announced). */
export interface AuthAttempt {
  failure: SubmitFailure | null;
  count: number;
}

export interface UseAuthActionOptions<V extends SubmittedValues> {
  /** The values of the submitted form. */
  read: (data: FormData) => V;
  /** The call, then where to go: resolves once done, rejects as `login` / `signup` do. */
  run: (values: V) => Promise<void>;
  /** Called with each failure, before it is shown (e.g. clear the password). */
  onFailure?: (failure: SubmitFailure) => void;
}

const NO_ATTEMPT: AuthAttempt = { failure: null, count: 0 };

/**
 * The sign-in or sign-up Action: pending state, the failure of the last submission
 * (`toSubmitFailure`) and, after a `429`, the seconds left before trying again.
 *
 * `submit(form)` starts it from the form's `onSubmit`, not through `<form action>`: the reset that
 * ends a form Action would tick « Rester connecté » again (React keeps a controlled text value
 * across it, not a checkbox) and empty what was typed meanwhile.
 */
export function useAuthAction<V extends SubmittedValues>({
  read,
  run,
  onFailure,
}: UseAuthActionOptions<V>) {
  // Set at once by `submit`, before `isPending` reaches a render: two submits in the same tick
  // (double click, Entrée held) send one request.
  const inFlight = useRef(false);
  const [attempt, dispatch, isPending] = useActionState(
    async (previous: AuthAttempt, data: FormData): Promise<AuthAttempt> => {
      const values = read(data);
      try {
        await run(values);
        return { failure: null, count: previous.count + 1 };
      } catch (error) {
        const failure = toSubmitFailure(error, values, Date.now());
        onFailure?.(failure);
        return { failure, count: previous.count + 1 };
      } finally {
        inFlight.current = false;
      }
    },
    NO_ATTEMPT,
  );
  const { failure } = attempt;
  const retryLeft = useCountdown(failure?.code === 'too-many-attempts' ? failure.until : null);
  const submit = (form: HTMLFormElement) => {
    if (inFlight.current) return;
    inFlight.current = true;
    const data = new FormData(form);
    startTransition(() => dispatch(data));
  };
  return { attempt, submit, isPending, retryLeft };
}

/** A form field read as text (`FormData` may also hold files). */
export function textOf(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
}
