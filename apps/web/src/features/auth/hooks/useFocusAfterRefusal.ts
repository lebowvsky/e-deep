import { useEffect, useEffectEvent } from 'react';
import type { SubmitFailure } from '../lib/authErrors';
import type { AuthAttempt } from './useAuthAction';

/**
 * After each refused submission, moves the focus where the diver acts next (DOM focus: the
 * effect's external system): `targetOf` says where, from the failure — the first field refused, or
 * the banner of a refusal no field can fix (docs/plans/auth-screens.md §1).
 */
export function useFocusAfterRefusal(
  attempt: AuthAttempt,
  targetOf: (failure: SubmitFailure) => HTMLElement | null,
): void {
  // Read at the refusal, not as a dependency: the forms pass an inline function.
  const focusTarget = useEffectEvent((failure: SubmitFailure) => {
    targetOf(failure)?.focus();
  });

  useEffect(() => {
    if (attempt.failure !== null) focusTarget(attempt.failure);
  }, [attempt]);
}

/** The first of `order` the API refused, `null` when the failure is not about the fields. */
export function firstRefusedField<F extends string>(
  failure: SubmitFailure,
  order: readonly F[],
): F | null {
  if (failure.code !== 'invalid-fields') return null;
  const { fields } = failure;
  return order.find((field) => field in fields) ?? null;
}
